/** Incremental locale extraction and a read-only Codex translation worker. No deployment. */
import { readFile, writeFile, mkdir, readdir, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { resolve, relative, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const requestedCommand = args.shift() || "scan";
const command = { translate: "run", check: "validate" }[requestedCommand] || requestedCommand;
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? fallback : args[i + 1];
};
const locales = ["en", "ru", "ja"];
const localeDir = resolve(root, "data/i18n");
const taskDir = resolve(root, "artifacts/i18n/tasks");
const manifestPath = resolve(taskDir, "manifest.json");
const hash = (text) => createHash("sha256").update(text).digest("hex");
// Compare numeric quantities, not locale-specific spellings. Do not discard unknown numbers.
function numbers(text, locale = "zh-CN") {
  text = text.normalize("NFKC");
  // Dynamic Chinese discount multipliers are emitted as {n}0% by existing UI templates.
  if (text.includes("%")) text = text.replace(/\{\d+\}0/g, "");
  text = text.replace(/\{\d+\}/g, "");
  const soft = [];
  // Explicit, bounded linguistic equivalents: these do not waive arbitrary new digits.
  if (/北京时间/.test(text) && !/UTC\s*\+\s*8/i.test(text)) soft.push(8);
  if (/计算到分|四舍五入到分/.test(text)) soft.push(2);
  if (/非负/.test(text)) soft.push(0);
  for (const _ of text.matchAll(/每页|每分钟|每个|每次出击|单局|同场|上一级|场均/g)) soft.push(1);
  const hanNumber = (word) => {
    const digits = {
      零: 0,
      一: 1,
      二: 2,
      两: 2,
      三: 3,
      四: 4,
      五: 5,
      六: 6,
      七: 7,
      八: 8,
      九: 9,
      双: 2,
      单: 1,
    };
    if (word === "十") return 10;
    if (word.includes("十")) {
      const [a, b] = word.split("十");
      return (a ? digits[a] : 1) * 10 + (b ? digits[b] : 0);
    }
    return [...word].reduce((n, char) => n * 10 + digits[char], 0);
  };
  text = text.replace(
    /[零一二两三四五六七八九十双单]+(?=个|次|辆|架|档|国|维|点|元|分|位|种|種|基地|機|回|台|段階|か国|軸|拠点)/g,
    (word) => {
      soft.push(hanNumber(word));
      return "";
    },
  );
  const wordValues = {
    zero: 0,
    one: 1,
    once: 1,
    single: 1,
    two: 2,
    twice: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };
  text = text.replace(
    /\b(zero|one|once|single|two|twice|three|four|five|six|seven|eight|nine|ten)\b/gi,
    (word) => {
      soft.push(wordValues[word.toLowerCase()]);
      return "";
    },
  );
  // Bare scale words denote one unit: 每万RP, 整万, 万, 亿.
  text = text.replace(/万|亿/g, (unit, offset) => {
    if (/\d$/.test(text.slice(0, offset).trimEnd())) return unit;
    soft.push(unit === "万" ? 10000 : 100000000);
    return "";
  });
  text = text.replace(/(\d+(?:\.\d+)?)\s*(折|割)/g, (_, n) => String(Number(n) * 10) + "%");
  const pattern = /\d{1,3}(?:[, \u00a0\u202f]\d{3})+(?:\.\d+)?|\d+(?:[.,]\d+)?/g;
  const values = [];
  for (const match of text.matchAll(pattern)) {
    let raw = match[0];
    if (/^\d{1,3}(?:[, \u00a0\u202f]\d{3})+(?:\.\d+)?$/.test(raw))
      raw = raw.replace(/[, \u00a0\u202f]/g, "");
    else if (locale === "ru") raw = raw.replace(",", ".");
    let value = Number(raw);
    const suffix = text.slice(match.index + match[0].length);
    const scale = suffix
      .match(
        /^\s*(万|亿|тыс\.?|млн\.?|thousand\b|million\b|billion\b|megapixels?\b|мегапиксел\p{L}*|[kKMB]\b)/u,
      )?.[1]
      ?.toLowerCase();
    if (scale)
      value *=
        scale === "万"
          ? 10000
          : scale === "亿"
            ? 100000000
            : /^(тыс|thousand|k)/.test(scale)
              ? 1000
              : /^(b|billion)/.test(scale)
                ? 1000000000
                : 1000000;
    values.push(value);
  }
  return { hard: values, soft };
}
function equalNumbers(source, target, locale) {
  const a = numbers(source);
  const b = numbers(target, locale);
  const remove = (list, value) => {
    const index = list.indexOf(value);
    if (index < 0) return false;
    list.splice(index, 1);
    return true;
  };
  for (const value of [...a.hard]) if (remove(b.hard, value)) remove(a.hard, value);
  return (
    a.hard.every((value) => remove(b.soft, value)) && b.hard.every((value) => remove(a.soft, value))
  );
}
const placeholders = (text) =>
  [...text.matchAll(/\{\d+\}/g)]
    .map((x) => x[0])
    .sort()
    .join(",");
const json = async (path, fallback) => {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT" && fallback !== undefined) return fallback;
    throw error;
  }
};
const save = async (path, value) => {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temp, path);
};
const localePath = (locale) => resolve(localeDir, `${locale}.json`);
const compact = new Map([
  ...["科技树", "出击队列", "陆战地图", "战绩查询", "折扣日历"].map((key) => [key, 22]),
  ...["登录", "重试", "取消", "完成", "关闭"].map((key) => [key, 14]),
  ...["雷达：胜率", "雷达：对空", "雷达：对地", "雷达：综合", "雷达：出击", "雷达：场均"].map(
    (key) => [key, 9],
  ),
]);
const terms = {
  研发点: { en: "Research points", ru: "Очки исследований", ja: "リサーチポイント" },
  金鹰: { en: "Golden Eagles", ru: "Золотые орлы", ja: "ゴールデンイーグル" },
  银狮: { en: "Silver Lions", ru: "Серебряные львы", ja: "シルバーライオン" },
  街机战斗: { en: "Arcade Battles", ru: "Аркадные бои", ja: "アーケードバトル" },
  历史战斗: { en: "Realistic Battles", ru: "Реалистичные бои", ja: "リアリスティックバトル" },
  全真战斗: { en: "Simulator Battles", ru: "Симуляторные бои", ja: "シミュレーターバトル" },
};
function validateEntry(key, source, value, locale) {
  if (typeof value !== "string" || !value.trim()) throw Error(`Empty ${locale}: ${key}`);
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value))
    throw Error(`Control character: ${key}`);
  if (!equalNumbers(source, value, locale))
    throw Error(
      `Numeric value changed (${locale}): ${key} [${JSON.stringify(numbers(source))}] -> [${JSON.stringify(numbers(value, locale))}]`,
    );
  if (placeholders(source) !== placeholders(value)) throw Error(`Placeholder mismatch: ${key}`);
  if (locale !== "ja" && /\p{Script=Han}/u.test(value))
    throw Error(`Untranslated Chinese: ${locale}: ${key}`);
  if (compact.has(key) && [...value].length > compact.get(key))
    throw Error(`Compact label too long: ${key}: ${value}`);
}
async function dictionaries() {
  const source = await json(localePath("zh-CN"));
  for (const [key, value] of Object.entries(source))
    if (typeof value !== "string" || !value.trim()) throw Error(`Invalid Chinese source: ${key}`);
  const targets = Object.fromEntries(
    await Promise.all(locales.map(async (locale) => [locale, await json(localePath(locale), {})])),
  );
  return { source, targets };
}
async function compiler() {
  // TS 7's native CLI has no JS AST API. Resolve the already-installed JS compiler.
  const directory = resolve(root, "node_modules/.pnpm");
  for (const entry of (await readdir(directory))
    .filter((name) => /^typescript@/.test(name))
    .sort()) {
    try {
      const api = (
        await import(
          pathToFileURL(resolve(directory, entry, "node_modules/typescript/lib/typescript.js")).href
        )
      ).default;
      if (api.createSourceFile) return api;
    } catch (error) {
      if (!["ERR_MODULE_NOT_FOUND", "ENOENT"].includes(error.code)) throw error;
    }
  }
  throw Error(
    "No TypeScript JS AST parser installed. Run pnpm install; extraction does not fall back to unsafe regex.",
  );
}
async function extract() {
  const ts = await compiler();
  const messages = new Map();
  const candidates = [];
  function record(value, node, file, explicit) {
    value = value.trim().replace(/\s+/g, " ");
    if (!/\p{Script=Han}/u.test(value)) return;
    const location = `${relative(root, file.fileName)}:${file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1}`;
    if (explicit) messages.set(value, [...(messages.get(value) || []), location]);
    else
      candidates.push({
        source: value,
        location,
        reason:
          "Display literal requires t()/localize() or explicit exclusion; not automatically added.",
      });
  }
  function display(node, file, explicit) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
      record(node.text, node, file, explicit);
    else if (ts.isTemplateExpression(node))
      record(
        node.head.text +
          node.templateSpans.map((span, index) => `{${index}}${span.literal.text}`).join(""),
        node,
        file,
        explicit,
      );
    else if (ts.isConditionalExpression(node)) {
      display(node.whenTrue, file, explicit);
      display(node.whenFalse, file, explicit);
    } else if (ts.isParenthesizedExpression(node)) display(node.expression, file, explicit);
    else if (ts.isArrayLiteralExpression(node))
      for (const item of node.elements) display(item, file, explicit);
    // Identifiers/property reads/calls are intentionally not interpreted: may contain user data.
  }
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (["generated", "i18n"].includes(entry.name)) continue;
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(path);
        continue;
      }
      if (!/\.tsx?$/.test(path) || /routeTree\.gen\.ts$/.test(path)) continue;
      const file = ts.createSourceFile(
        path,
        await readFile(path, "utf8"),
        ts.ScriptTarget.Latest,
        true,
      );
      const visit = (node) => {
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          ["t", "localize"].includes(node.expression.text) &&
          node.arguments[0]
        )
          display(node.arguments[0], file, true);
        if (!path.endsWith("LanguageSwitch.tsx")) {
          if (ts.isJsxText(node)) record(node.text, node, file, false);
          if (ts.isJsxExpression(node) && node.expression && !ts.isJsxAttribute(node.parent))
            display(node.expression, file, false);
          if (
            ts.isJsxAttribute(node) &&
            ["title", "placeholder", "aria-label", "alt"].includes(node.name.text) &&
            node.initializer
          ) {
            if (ts.isStringLiteral(node.initializer))
              record(node.initializer.text, node, file, false);
            else if (ts.isJsxExpression(node.initializer) && node.initializer.expression)
              display(node.initializer.expression, file, false);
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(file);
    }
  }
  await walk(resolve(root, "src"));
  return { messages, candidates };
}
async function scan() {
  const { source, targets } = await dictionaries();
  const { messages, candidates } = await extract();
  const previous = await json(manifestPath, { approved: {} });
  const added = [];
  for (const [key] of messages)
    if (!Object.hasOwn(source, key)) {
      source[key] = key;
      added.push(key);
    }
  if (args.includes("--write")) await save(localePath("zh-CN"), source);
  const pending = {};
  const approved = previous.approved || {};
  for (const locale of locales) {
    approved[locale] ||= {};
    pending[locale] = [];
    for (const [key, value] of Object.entries(source)) {
      const translated = targets[locale][key];
      const fingerprint = hash(value);
      // First scan adopts existing manual translations as the baseline; subsequent edits are detected.
      if (!approved[locale][key] && translated?.trim()) approved[locale][key] = fingerprint;
      const reason = !translated?.trim()
        ? "missing"
        : approved[locale][key] !== fingerprint
          ? "source-changed"
          : null;
      if (reason)
        pending[locale].push({
          key,
          source: value,
          sourceHash: fingerprint,
          previousHash: hash(translated || ""),
          reason,
          locations: messages.get(key) || [],
        });
    }
  }
  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    approved,
    pending,
    added,
    candidates,
  };
  await save(manifestPath, manifest);
  console.log(
    JSON.stringify({
      added: added.length,
      sourceWritten: args.includes("--write"),
      reviewCandidates: candidates.length,
      pending: Object.fromEntries(locales.map((locale) => [locale, pending[locale].length])),
      manifest: relative(root, manifestPath),
    }),
  );
  return manifest;
}
async function prepare(manifest, locale, limit) {
  if (!locales.includes(locale)) throw Error("--locale must be en, ru or ja");
  const items = manifest.pending[locale]
    .filter((item) => item.reason === "missing" || args.includes("--review-source-changes"))
    .slice(0, limit);
  if (!items.length) return null;
  const id = `${locale}-${Date.now()}`;
  const path = resolve(taskDir, `${id}.json`);
  const task = {
    version: 1,
    id,
    locale,
    items,
    terms,
    instructions: [
      "Translate only the supplied items; use concise War Thunder game UI terminology, not literal prose.",
      "Use native Japanese / English / Russian grammar. Rank is not battle rating. Never change RP, GE, SL, GJN, CNY values or prices.",
      "Preserve each {n} placeholder including repetitions. Preserve proper vehicle names unless supplied verified official localization.",
      "Never translate user nicknames, saved plan names, storage keys or code IDs. No invented vehicle names.",
      "Use supplied English/Russian existing terminology as context where present. Return only requested JSON entries.",
      "Do not use tools, read credentials, edit files, publish, commit or deploy. The parent process handles validated file merging.",
    ],
    compactLimits: Object.fromEntries(compact),
  };
  const { targets } = await dictionaries();
  task.items = items.map((item) => ({
    ...item,
    context: Object.fromEntries(
      locales
        .filter((other) => other !== locale && targets[other][item.key])
        .map((other) => [other, targets[other][item.key]]),
    ),
  }));
  await save(path, task);
  await writeFile(
    resolve(taskDir, `${id}.prompt.txt`),
    `You are the dedicated War Thunder localization sub-agent. Follow the task instructions. Output schema: {"entries":[{"key":"source key","value":"translation"}]}.\n${JSON.stringify(task, null, 2)}\n`,
  );
  return { task, path };
}
async function apply(taskPath, resultPath, reviewed = false) {
  const task = await json(taskPath);
  if (!locales.includes(task.locale)) throw Error("Invalid task locale");
  const result = await json(resultPath);
  if (!Array.isArray(result.entries)) throw Error("Expected entries array");
  const { source, targets } = await dictionaries();
  const target = targets[task.locale];
  const wanted = new Map(task.items.map((item) => [item.key, item]));
  const seen = new Set();
  const accepted = [];
  for (const entry of result.entries) {
    const item = wanted.get(entry.key);
    if (!item || seen.has(entry.key)) throw Error(`Unexpected/duplicate result key: ${entry.key}`);
    seen.add(entry.key);
    if (hash(source[entry.key] || "") !== item.sourceHash)
      throw Error(`Source changed while translating: ${entry.key}`);
    if (hash(target[entry.key] || "") !== item.previousHash)
      throw Error(`Translation edited while translating: ${entry.key}`);
    validateEntry(entry.key, item.source, entry.value, task.locale);
    if (item.reason === "source-changed" && !reviewed) continue;
    target[entry.key] = entry.value;
    accepted.push(entry.key);
  }
  if (seen.size !== wanted.size) throw Error(`Incomplete result: ${seen.size}/${wanted.size}`);
  await save(localePath(task.locale), target);
  const manifest = await json(manifestPath, { approved: {} });
  manifest.approved ||= {};
  manifest.approved[task.locale] ||= {};
  for (const key of accepted) manifest.approved[task.locale][key] = hash(source[key]);
  await save(manifestPath, manifest);
  console.log(
    JSON.stringify({
      locale: task.locale,
      merged: accepted.length,
      requiresReview: seen.size - accepted.length,
    }),
  );
}
async function agent(prepared) {
  const { task, path } = prepared;
  const resultPath = resolve(taskDir, `${task.id}.result.json`);
  const schemaPath = resolve(taskDir, "response.schema.json");
  await save(schemaPath, {
    type: "object",
    additionalProperties: false,
    required: ["entries"],
    properties: {
      entries: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["key", "value"],
          properties: { key: { type: "string" }, value: { type: "string" } },
        },
      },
    },
  });
  const prompt = await readFile(resolve(taskDir, `${task.id}.prompt.txt`), "utf8");
  // Existing Codex auth/profile is inherited. No API keys are copied into arguments or task files.
  await new Promise((done, reject) => {
    const child = spawn(
      "codex",
      [
        "exec",
        "--sandbox",
        "read-only",
        "--ephemeral",
        "--color",
        "never",
        "--output-schema",
        schemaPath,
        "--output-last-message",
        resultPath,
        "-C",
        root,
        "-",
      ],
      { stdio: ["pipe", "ignore", "pipe"] },
    );
    let diagnostic = "";
    child.stderr.on("data", (data) => {
      diagnostic = (diagnostic + data).slice(-4000);
    });
    const timer = setTimeout(
      () => {
        child.kill("SIGTERM");
        setTimeout(() => child.kill("SIGKILL"), 5000).unref();
      },
      10 * 60 * 1000,
    );
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      code === 0
        ? done()
        : reject(
            Error(
              `Codex translation failed (${code}); task retained at ${path}. ${diagnostic.includes("401") ? "Check existing Codex login." : "Run codex login status and inspect the task; no locale was merged."}`,
            ),
          );
    });
    child.stdin.on("error", () => {});
    child.stdin.end(prompt);
  });
  await apply(path, resultPath);
}
async function validate() {
  const { source, targets } = await dictionaries();
  const warnings = [];
  for (const locale of locales)
    for (const [key, value] of Object.entries(source)) {
      try {
        validateEntry(key, value, targets[locale][key], locale);
      } catch (error) {
        warnings.push({ error: error.message });
      }
      if (terms[key]?.[locale] && targets[locale][key] !== terms[key][locale])
        warnings.push({ key, locale, actual: targets[locale][key], preferred: terms[key][locale] });
    }
  console.log(
    JSON.stringify(
      { messages: Object.keys(source).length, locales, termReview: warnings },
      null,
      2,
    ),
  );
  if (warnings.some((item) => item.error)) process.exitCode = 1;
}
try {
  if (command === "scan") await scan();
  else if (command === "validate") await validate();
  else if (command === "apply") {
    if (!option("task") || !option("result")) throw Error("apply requires --task and --result");
    await apply(
      resolve(root, option("task")),
      resolve(root, option("result")),
      args.includes("--reviewed"),
    );
  } else if (["prepare", "run"].includes(command)) {
    const limit = Number(option("limit", "50"));
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw Error("--limit must be 1..100");
    const manifest = await scan();
    const prepared = await prepare(manifest, option("locale", "ja"), limit);
    if (!prepared) console.log("No pending translations.");
    else if (command === "run" && !args.includes("--dry-run")) {
      await agent(prepared);
      await scan();
    } else console.log(`Task: ${relative(root, prepared.path)}`);
  } else
    throw Error(
      "Commands: scan [--write], prepare|translate --locale ja --limit 50 [--write], validate, apply --task FILE --result FILE [--reviewed]",
    );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
