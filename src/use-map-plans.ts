import { useEffect, useEffectEvent, useRef, useState } from "react";
import { MapPlanStore, planStorageError } from "./map-editor-plans";
import type { MapPlanLibrary } from "./map-editor-plans";
import { makeProject } from "./map-editor-model";
import type { Annotation, EditorContext } from "./map-editor-model";

export function useMapPlans(
  context: EditorContext,
  legacy: Annotation[],
  icons: ReadonlySet<string>,
  restore: (items: Annotation[], id: string) => void,
) {
  const [store] = useState(() => new MapPlanStore(context, icons));
  const [seedProject] = useState(() => makeProject(context, legacy));
  const [library, setLibrary] = useState<MapPlanLibrary | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const activeId = useRef<string | null>(null);
  const revision = useRef(0);
  const dirty = useRef(false);
  const lastWrite = useRef<Promise<unknown>>(Promise.resolve());
  const mounted = useRef(true);
  const operation = useRef(false);
  const applyLoaded = useEffectEvent((next: MapPlanLibrary) => {
    activeId.current = next.activeId;
    setLibrary(next);
    restore(next.plans.find((plan) => plan.id === next.activeId)!.project.items, next.activeId);
    setLoading(false);
  });
  useEffect(() => {
    let cancelled = false;
    mounted.current = true;
    store
      .load(seedProject)
      .then((next) => {
        if (!cancelled) applyLoaded(next);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoading(false);
          setError(planStorageError(error));
        }
      });
    return () => {
      cancelled = true;
      mounted.current = false;
    };
  }, [store, seedProject]);
  function save(items: Annotation[]) {
    dirty.current = true;
    const id = activeId.current;
    if (!id) {
      const error = new Error("当前无法保存到浏览器，请导出编辑文件保留内容");
      setError(error.message);
      lastWrite.current = Promise.reject(error);
      void lastWrite.current.catch(() => {});
      return;
    }
    const current = ++revision.current;
    setSaving(true);
    const task = store.save(id, makeProject(context, items)).then(
      (next) => {
        if (current === revision.current) dirty.current = false;
        if (!mounted.current) return;
        setLibrary({ ...next, activeId: activeId.current || next.activeId });
        if (current === revision.current) {
          setSaving(false);
          setError("");
        }
      },
      (error: unknown) => {
        if (mounted.current && current === revision.current) {
          setSaving(false);
          setError(planStorageError(error));
        }
        throw error;
      },
    );
    lastWrite.current = task;
    void task.catch(() => {});
  }
  async function flush() {
    await lastWrite.current;
  }
  async function act(change: () => Promise<MapPlanLibrary>, replace: boolean) {
    if (operation.current) throw new Error("正在处理方案，请稍候");
    if (!activeId.current) throw new Error("当前无法保存方案，请先导出编辑文件保留内容");
    operation.current = true;
    setWorking(true);
    try {
      await flush();
      const next = await change();
      activeId.current = next.activeId;
      setLibrary(next);
      setError("");
      if (replace)
        restore(next.plans.find((plan) => plan.id === next.activeId)!.project.items, next.activeId);
    } catch (error) {
      setError(planStorageError(error));
      throw error;
    } finally {
      operation.current = false;
      setWorking(false);
    }
  }
  return {
    library,
    loading,
    working,
    saving,
    error,
    save,
    flush,
    hasUnsaved: () => dirty.current,
    markExported: () => {
      dirty.current = false;
    },
    active: library?.plans.find((plan) => plan.id === library.activeId),
    select: (id: string) => act(() => store.select(id), true),
    create: (name: string, items: Annotation[]) =>
      act(() => store.create(name, makeProject(context, items)), true),
    rename: (name: string) => act(() => store.rename(activeId.current!, name), false),
    remove: () => act(() => store.remove(activeId.current!), true),
  };
}
