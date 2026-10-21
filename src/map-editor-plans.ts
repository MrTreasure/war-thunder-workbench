import {
  MAX_FILE_BYTES,
  makeProject,
  parseProject,
  sameContext,
  serializeProject,
} from "./map-editor-model.ts";
import type { EditorContext, MapProject } from "./map-editor-model.ts";

export type MapPlan = { id: string; name: string; project: MapProject };
export type MapPlanLibrary = { version: 1; activeId: string; plans: MapPlan[] };
export const MAX_PLANS = 50;
export interface PlanFiles {
  read: () => Promise<string | null>;
  write: (body: string) => Promise<void>;
}
type Lock = <T>(operation: () => Promise<T>) => Promise<T>;
export const planFileName = (context: EditorContext) =>
  `m${context.mapId.length}_${encodeURIComponent(context.mapId)}_l${context.layoutId.length}_${encodeURIComponent(context.layoutId)}_t${context.team}.json`;

function opfsFiles(context: EditorContext): PlanFiles {
  let directory: Promise<FileSystemDirectoryHandle> | undefined;
  const root = () =>
    (directory ??= (async () => {
      if (!globalThis.isSecureContext || typeof navigator.storage?.getDirectory !== "function")
        throw new Error("当前浏览器不支持本地方案保存，请导出编辑文件保留内容");
      const root = await navigator.storage.getDirectory();
      return root.getDirectoryHandle("wt-map-plans-v1", { create: true });
    })());
  return {
    async read() {
      try {
        const file = await (await (await root()).getFileHandle(planFileName(context))).getFile();
        if (file.size > MAX_FILE_BYTES * MAX_PLANS + 65536)
          throw new Error("本地方案文件过大，原文件已保留");
        return file.text();
      } catch (error) {
        if (error instanceof DOMException && error.name === "NotFoundError") return null;
        throw error;
      }
    },
    async write(body) {
      const handle = await (await root()).getFileHandle(planFileName(context), { create: true });
      const writable = await handle.createWritable();
      try {
        await writable.write(body);
        // createWritable commits on close; failed writes leave the previous file intact.
        await writable.close();
      } catch (error) {
        await writable.abort().catch(() => {});
        throw error;
      }
    },
  };
}
function planName(name: string) {
  const value = name.trim();
  if (!value || value.length > 60 || [...value].some((char) => char.charCodeAt(0) < 32))
    throw new Error("方案名称需为 1 至 60 个字");
  return value;
}
export function planStorageError(error: unknown): string {
  if (error instanceof SyntaxError) return "本地方案文件无法读取，原文件已保留，请先导出当前内容";
  if (error instanceof DOMException && error.name === "QuotaExceededError")
    return "浏览器空间不足，原方案已保留；请导出当前内容后整理方案";
  if (error instanceof DOMException && ["NotAllowedError", "SecurityError"].includes(error.name))
    return "浏览器限制了本地方案保存，请导出编辑文件保留内容";
  return error instanceof Error ? error.message : "本地保存失败，请导出当前内容后重试";
}

/** User documents have their own OPFS directory and are never cache eviction targets. */
export class MapPlanStore {
  readonly context: EditorContext;
  private icons: ReadonlySet<string>;
  private tail: Promise<unknown> = Promise.resolve();
  private files: PlanFiles;
  private lock: Lock;
  constructor(
    context: EditorContext,
    icons: ReadonlySet<string>,
    files: PlanFiles = opfsFiles(context),
    lock?: Lock,
  ) {
    this.context = context;
    this.icons = icons;
    this.files = files;
    this.lock =
      lock ||
      ((operation) =>
        typeof navigator !== "undefined" && navigator.locks
          ? navigator.locks.request(`wt-map-plans-v1:${planFileName(context)}`, operation)
          : operation());
  }
  private parse(value: unknown): MapPlanLibrary {
    const library = value as Partial<MapPlanLibrary> | null;
    if (
      !library ||
      library.version !== 1 ||
      !Array.isArray(library.plans) ||
      !library.plans.length ||
      library.plans.length > MAX_PLANS
    )
      throw new Error("本地方案资料无法读取，原文件已保留，请勿清理浏览器数据");
    const ids = new Set<string>();
    const names = new Set<string>();
    const plans = library.plans.map((plan): MapPlan => {
      if (
        !plan ||
        typeof plan.id !== "string" ||
        !/^[a-zA-Z0-9_-]{1,80}$/.test(plan.id) ||
        ids.has(plan.id) ||
        typeof plan.name !== "string"
      )
        throw new Error("本地方案编号无效，原文件已保留");
      ids.add(plan.id);
      const name = planName(plan.name);
      if (names.has(name)) throw new Error("本地方案名称重复，原文件已保留");
      names.add(name);
      const project = parseProject(plan.project, this.icons, (c) => sameContext(c, this.context));
      serializeProject(project);
      return { id: plan.id, name, project };
    });
    if (typeof library.activeId !== "string" || !ids.has(library.activeId))
      throw new Error("本地方案选择无效，原文件已保留");
    return { version: 1, activeId: library.activeId, plans };
  }
  private queue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(() => this.lock(operation));
    this.tail = result.catch(() => {});
    return result;
  }
  load(legacy: MapProject): Promise<MapPlanLibrary> {
    return this.queue(async () => {
      const body = await this.files.read();
      if (body !== null) return this.parse(JSON.parse(body));
      const library = this.parse({
        version: 1,
        activeId: "default",
        plans: [{ id: "default", name: "默认方案", project: legacy }],
      });
      await this.files.write(JSON.stringify(library));
      return library;
    });
  }
  private mutate(update: (library: MapPlanLibrary) => MapPlanLibrary): Promise<MapPlanLibrary> {
    return this.queue(async () => {
      // Re-read under the lock so another tab cannot silently lose its saved plans.
      const body = await this.files.read();
      if (body === null) throw new Error("本地方案文件不存在，请导出当前内容后重新打开地图");
      const next = this.parse(update(this.parse(JSON.parse(body))));
      await this.files.write(JSON.stringify(next));
      return next;
    });
  }
  save(id: string, project: MapProject) {
    return this.mutate((library) => {
      if (!library.plans.some((plan) => plan.id === id))
        throw new Error("该方案已被其他页面删除，请另存当前内容");
      return {
        ...library,
        plans: library.plans.map((plan) => (plan.id === id ? { ...plan, project } : plan)),
      };
    });
  }
  select(id: string) {
    return this.mutate((library) => ({ ...library, activeId: id }));
  }
  create(name: string, project = makeProject(this.context, [])) {
    const id = crypto.randomUUID();
    return this.mutate((library) => {
      if (library.plans.length >= MAX_PLANS)
        throw new Error("每个地图布局最多保存 50 个方案，请先导出或删除不需要的方案");
      const value = planName(name);
      if (library.plans.some((plan) => plan.name === value))
        throw new Error("已存在同名方案，请换一个名称");
      return { ...library, activeId: id, plans: [...library.plans, { id, name: value, project }] };
    });
  }
  rename(id: string, name: string) {
    return this.mutate((library) => {
      const value = planName(name);
      if (!library.plans.some((plan) => plan.id === id)) throw new Error("该方案不存在");
      if (library.plans.some((plan) => plan.id !== id && plan.name === value))
        throw new Error("已存在同名方案，请换一个名称");
      return {
        ...library,
        activeId: id,
        plans: library.plans.map((plan) => (plan.id === id ? { ...plan, name: value } : plan)),
      };
    });
  }
  remove(id: string) {
    return this.mutate((library) => {
      if (library.plans.length <= 1) throw new Error("请至少保留一个方案，可用“清除标记”重新绘制");
      const plans = library.plans.filter((plan) => plan.id !== id);
      return {
        ...library,
        activeId: library.activeId === id ? plans[0].id : library.activeId,
        plans,
      };
    });
  }
}
