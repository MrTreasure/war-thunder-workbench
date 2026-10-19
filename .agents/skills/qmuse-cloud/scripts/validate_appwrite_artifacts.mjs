#!/usr/bin/env node

import fs from "node:fs";
import { isIP } from "node:net";
import path from "node:path";

const projectRoot = path.resolve(process.argv[2] || process.cwd());
const errors = [];

const paths = {
  backend: "src/config/.db_backend.json",
  schema: "src/config/.appwrite_schema.json",
  auth: "src/config/.appwrite_auth.json",
  service: "src/services/appwrite.ts",
};

function report(message) {
  errors.push(message);
}

function readText(relativePath) {
  const absolutePath = path.join(projectRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    report(`${relativePath}: 文件不存在`);
    return null;
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function readJson(relativePath) {
  const content = readText(relativePath);
  if (content === null) {
    return null;
  }
  try {
    return JSON.parse(content);
  } catch (error) {
    report(
      `${relativePath}: JSON 无法解析（${
        error instanceof Error ? error.message : String(error)
      }）`
    );
    return null;
  }
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function walkFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(absolutePath) : [absolutePath];
  });
}

const FUNCTION_SOURCE_FILE_PATTERN = /\.(?:cjs|mjs|js|jsx|ts|tsx)$/i;
const IGNORED_FUNCTION_DIRECTORIES = new Set([
  ".git",
  "build",
  "coverage",
  "dist",
  "node_modules",
]);

function walkFunctionSourceFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return IGNORED_FUNCTION_DIRECTORIES.has(entry.name)
        ? []
        : walkFunctionSourceFiles(absolutePath);
    }
    return entry.isFile() && FUNCTION_SOURCE_FILE_PATTERN.test(entry.name)
      ? [absolutePath]
      : [];
  });
}

function maskRange(characters, start, end) {
  for (let index = start; index <= end; index += 1) {
    if (characters[index] !== "\n") {
      characters[index] = " ";
    }
  }
}

function analyzeSource(source) {
  const code = source.split("");
  const codeWithStrings = source.split("");
  const strings = [];

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const nextCharacter = source[index + 1];

    if (character === "/" && nextCharacter === "/") {
      const lineEnd = source.indexOf("\n", index + 2);
      const end = lineEnd < 0 ? source.length - 1 : lineEnd - 1;
      maskRange(code, index, end);
      maskRange(codeWithStrings, index, end);
      index = end;
      continue;
    }

    if (character === "/" && nextCharacter === "*") {
      const commentEnd = source.indexOf("*/", index + 2);
      const end = commentEnd < 0 ? source.length - 1 : commentEnd + 1;
      maskRange(code, index, end);
      maskRange(codeWithStrings, index, end);
      index = end;
      continue;
    }

    if (character !== '"' && character !== "'" && character !== "`") {
      continue;
    }

    const quote = character;
    const start = index;
    let value = "";
    for (index += 1; index < source.length; index += 1) {
      const literalCharacter = source[index];
      if (literalCharacter === "\\") {
        value += literalCharacter;
        if (index + 1 < source.length) {
          value += source[index + 1];
          index += 1;
        }
        continue;
      }
      if (literalCharacter === quote) {
        break;
      }
      value += literalCharacter;
    }
    strings.push(value);
    maskRange(code, start, Math.min(index, source.length - 1));
  }

  return {
    code: code.join(""),
    codeWithStrings: codeWithStrings.join(""),
    strings,
  };
}

function validateFileMutations(relativePath, source) {
  const { code, codeWithStrings, strings } = analyzeSource(source);
  const storageContext =
    /\b(?:Storage|appwriteStorage|fileStorage|bucketId|storageBucketId)\b/.test(
      code
    ) ||
    strings.some((value) =>
      /appwrite|appbase|\/storage\/buckets\//.test(value)
    );
  const mutationMember =
    /\.\s*(?:deleteFile|updateFile)\b/.test(code) ||
    [
      ...codeWithStrings.matchAll(
        /\[\s*["'](?:deleteFile|updateFile)["']\s*\]/g
      ),
    ].some((match) => code[match.index] === "[");
  const mutationDestructure =
    /\{[^{}]*\b(?:deleteFile|updateFile)\b[^{}]*\}\s*=/.test(code);
  const directMutationRequest =
    strings.some((value) => /\/storage\/buckets\//.test(value)) &&
    /\bmethod\s*:\s*["'`](?:DELETE|PUT|PATCH)["'`]/i.test(codeWithStrings);
  if (
    (storageContext && (mutationMember || mutationDestructure)) ||
    directMutationRequest
  ) {
    report(
      `${relativePath}: QMUSE_STORAGE_MUTATION_UNSUPPORTED: 生成应用不支持修改或物理删除云存储原文件。移除文件修改/删除调用及对应运行时按钮，不得添加底层请求或云函数绕过；仅在创作对话中引导创建者或管理员前往「云服务面板 → 文件存储」操作，不得将此引导写入作品页面。正常数据库记录删除、展示名称和附件引用维护不受影响，但不能声称已删除原文件`
    );
  }
}

function hasIndirectEnvironmentAccess(code) {
  for (const match of code.matchAll(/process\s*\.\s*env/g)) {
    const following = code.slice(match.index + match[0].length);
    if (!/^\s*\.\s*[A-Za-z][A-Za-z0-9_]*/.test(following)) {
      return true;
    }
  }
  return /Deno\s*\.\s*env\s*\.\s*get\s*\(/.test(code);
}

function validateFunctionSecretConsumption(schema) {
  if (!isObject(schema) || !Array.isArray(schema.functions)) {
    return;
  }

  for (const fn of schema.functions) {
    if (!isObject(fn)) {
      continue;
    }
    const functionId = isNonEmptyString(fn.functionId) ? fn.functionId : "";
    const functionPath = isNonEmptyString(fn.path)
      ? fn.path
      : functionId
      ? `functions/${functionId}`
      : "";
    if (!functionPath) {
      continue;
    }

    const absoluteFunctionPath = path.resolve(projectRoot, functionPath);
    const relativeFunctionPath = path.relative(
      projectRoot,
      absoluteFunctionPath
    );
    if (
      relativeFunctionPath.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relativeFunctionPath)
    ) {
      report(
        `${paths.schema}: function ${
          functionId || functionPath
        } 的 path 不得超出项目目录`
      );
      continue;
    }

    let usesTablesDb = false;
    let readsManagedDatabaseId = false;
    let hardcodesDatabaseId = false;
    for (const absolutePath of walkFunctionSourceFiles(absoluteFunctionPath)) {
      const content = fs.readFileSync(absolutePath, "utf8");
      validateFileMutations(path.relative(projectRoot, absolutePath), content);
      const { code, codeWithStrings } = analyzeSource(content);
      usesTablesDb ||= /\bTablesDB\b/.test(code);
      readsManagedDatabaseId ||=
        /process\s*\.\s*env\s*\.\s*QMUSE_APPWRITE_DATABASE_ID\b/.test(code);
      hardcodesDatabaseId ||=
        /\bdatabaseId\s*:\s*["'`]/.test(codeWithStrings) ||
        /\b(?:const|let|var)\s+databaseId\s*=\s*["'`]/.test(codeWithStrings);
      if (hasIndirectEnvironmentAccess(code)) {
        report(
          `${path.relative(
            projectRoot,
            absolutePath
          )}: 环境变量必须直接使用 process.env.SECRET_KEY 读取，不得使用计算属性、动态名称、解构、环境对象别名或 Deno.env.get`
        );
      }
    }
    if (usesTablesDb && !readsManagedDatabaseId) {
      report(
        `${functionPath}: 使用 TablesDB 的云函数必须直接读取 process.env.QMUSE_APPWRITE_DATABASE_ID`
      );
    }
    if (usesTablesDb && hardcodesDatabaseId) {
      report(`${functionPath}: 使用 TablesDB 的云函数不得硬编码 databaseId`);
    }
  }
}

function findClosingParenthesis(code, openIndex) {
  let depth = 0;
  for (let index = openIndex; index < code.length; index += 1) {
    const character = code[index];
    if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function extractFunctionCalls(source, functionName) {
  const calls = [];
  const code = analyzeSource(source).code;
  const callPattern = new RegExp(
    `\\b${escapeRegExp(functionName)}\\s*\\(`,
    "g"
  );
  for (const match of code.matchAll(callPattern)) {
    const openIndex = match.index + match[0].lastIndexOf("(");
    const closeIndex = findClosingParenthesis(code, openIndex);
    if (closeIndex < 0) {
      continue;
    }
    calls.push(source.slice(match.index, closeIndex + 1));
  }
  return calls;
}

function extractFetchCalls(source) {
  return extractFunctionCalls(source, "fetch");
}

const HAND_WRITTEN_APPWRITE_QUERY_PATTERN =
  /^\s*(?:between|contains|cursorAfter|cursorBefore|endsWith|equal|greaterThan|greaterThanEqual|isNotNull|isNull|lessThan|lessThanEqual|limit|notContains|notEqual|offset|orderAsc|orderDesc|search|select|startsWith)\s*\(/;
const RUNTIME_OWNED_QUERY_PATTERN =
  /\bQuery\s*\.\s*(?:cursorAfter|cursorBefore|limit|offset|orderAsc|orderDesc)\s*\(/;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectEndpointAliases(source, markers) {
  return new Set(
    Array.from(
      source.matchAll(
        /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;]+);/g
      ),
      (match) => ({ name: match[1], expression: match[2] })
    )
      .filter((declaration) =>
        markers.some((marker) => marker.test(declaration.expression))
      )
      .map((declaration) => declaration.name)
  );
}

function requireCredentialedFetch(source, label, markers) {
  const aliases = collectEndpointAliases(source, markers);
  const endpointCalls = extractFetchCalls(source).filter(
    (call) =>
      markers.some((marker) => marker.test(call)) ||
      Array.from(aliases).some((alias) =>
        new RegExp(`\\b${escapeRegExp(alias)}\\b`).test(call)
      )
  );

  if (endpointCalls.length === 0) {
    report(`${paths.service}: 必须通过 fetch 请求 ${label}`);
    return;
  }
  if (
    endpointCalls.some(
      (call) =>
        !/(?:\bcredentials\b|["']credentials["'])\s*:\s*["']include["']/.test(
          call
        )
    )
  ) {
    report(
      `${paths.service}: ${label} 的 fetch 必须设置 credentials: "include"`
    );
  }
}

function validateSourceRules(source, relativePath, rules) {
  for (const [pattern, message] of rules.required ?? []) {
    if (!pattern.test(source)) {
      report(`${relativePath}: ${message}`);
    }
  }
  for (const [pattern, message] of rules.forbidden ?? []) {
    if (pattern.test(source)) {
      report(`${relativePath}: ${message}`);
    }
  }
}

const RUNTIME_SERVICE_RULES = {
  required: [
    [
      /\bcreateQmuseAppwriteRuntime\s*\(/,
      "必须通过 createQmuseAppwriteRuntime() 创建 Runtime facade",
    ],
    [/\bgetMuseRuntime\b/, "Runtime facade 必须提供 getMuseRuntime"],
    [/\bgetQmuseLoginUserId\b/, "Runtime facade 必须提供 getQmuseLoginUserId"],
    [
      /\bgetAppwriteClients\s*=\s*runtime\.getClients\b/,
      "必须导出 Runtime SDK 的 getAppwriteClients facade",
    ],
  ],
};

const WEB_SERVICE_RULES = {
  required: [
    [
      /\bwindow\s*\.\s*__MUSE__\s*\?\.\s*appwrite\b/,
      "Web Runtime 必须读取 window.__MUSE__.appwrite 动态配置",
    ],
    [
      /\bappwriteConfig\s*:\s*getInjectedAppwriteConfig\s*\(\s*\)/,
      "Web Runtime 必须将动态配置作为 appwriteConfig 传给 Runtime",
    ],
  ],
  forbidden: [
    [/\bappVersionId\b/, "QmuseRuntimeContext 不得包含 appVersionId"],
  ],
};

function validateProjectConfig() {
  const backend = readJson(paths.backend);
  if (isObject(backend)) {
    const expected = {
      backend: "appwrite",
      schemaFile: paths.schema,
      authFile: paths.auth,
      clientFile: paths.service,
    };
    for (const [key, value] of Object.entries(expected)) {
      if (backend[key] !== value) {
        report(`${paths.backend}: ${key} 必须为 ${JSON.stringify(value)}`);
      }
    }
  } else if (backend !== null) {
    report(`${paths.backend}: 必须是 JSON 对象`);
  }

  const auth = readJson(paths.auth);
  if (isObject(auth) && Object.keys(auth).length > 0) {
    report(`${paths.auth}: 必须严格等于 {}`);
  } else if (auth !== null && !isObject(auth)) {
    report(`${paths.auth}: 必须是空 JSON 对象`);
  }
}

function validatePackageJson() {
  const packageJson = readJson("package.json");
  if (!isObject(packageJson)) {
    if (packageJson !== null) {
      report("package.json: 必须是 JSON 对象");
    }
    return;
  }

  const dependencies = {
    ...(isObject(packageJson.dependencies) ? packageJson.dependencies : {}),
    ...(isObject(packageJson.devDependencies)
      ? packageJson.devDependencies
      : {}),
  };
  if (typeof dependencies["@qmuse/appwrite-runtime-sdk"] !== "string") {
    report("package.json: 必须声明 @qmuse/appwrite-runtime-sdk");
  }
  const runtimeSdkVersion = dependencies["@qmuse/appwrite-runtime-sdk"];
  const servicePath = path.join(projectRoot, paths.service);
  const serviceUsesFileStorage =
    fs.existsSync(servicePath) &&
    /\bruntime\.(?:uploadFile|listFiles|getFile|getFileViewUrl|getFilePreviewUrl|getFileDownloadUrl)\b/.test(
      fs.readFileSync(servicePath, "utf8")
    );
  const exactRuntimeVersion =
    typeof runtimeSdkVersion === "string"
      ? runtimeSdkVersion.trim().match(/^[~^]?(\d+)\.(\d+)\.(\d+)$/)
      : null;
  if (
    serviceUsesFileStorage &&
    exactRuntimeVersion &&
    (Number(exactRuntimeVersion[1]) < 1 ||
      (Number(exactRuntimeVersion[1]) === 1 &&
        Number(exactRuntimeVersion[2]) < 2))
  ) {
    report(
      "package.json: 文件存储要求 @qmuse/appwrite-runtime-sdk 1.2.0 或更高版本"
    );
  }
  if (dependencies.appwrite !== "24.1.1") {
    report(
      "package.json: appwrite 必须固定为 Runtime SDK peer dependency 版本 24.1.1"
    );
  }
  if (hasOwn(dependencies, "node-appwrite")) {
    report("package.json: 浏览器项目不得声明 node-appwrite");
  }
}

validateProjectConfig();
validatePackageJson();
const schema = readJson(paths.schema);
const schemaIdentifierPattern = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;
const reservedColumns = new Set([
  "code",
  "creatorId",
  "modifierId",
  "gmtCreate",
  "gmtModified",
]);
const forbiddenIndexAttributes = new Set([
  ...reservedColumns,
  "$id",
  "$createdAt",
  "$updatedAt",
  "$permissions",
]);

const ALLOWED_COLUMN_TYPES = new Set([
  "string",
  "integer",
  "double",
  "boolean",
  "datetime",
]);
const ALLOWED_STRING_FORMATS = new Set(["email", "enum", "ip", "url"]);
const UNSUPPORTED_COLUMN_PROPERTIES = new Set([
  "array",
  "signed",
  "min",
  "max",
  "filters",
  "formatOptions",
]);
const ALLOWED_INDEX_TYPES = new Set(["key", "unique", "fulltext"]);
const COLUMN_KEY_PATTERN = schemaIdentifierPattern;
const FUNCTION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/;
const FUNCTION_RUNTIME_PATTERN = /^node-(?:1[89]|2[0-5])(?:\.\d+)?$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_REGEX = /^https?:\/\/[^\s]+$/;
const STRING_MAX_SIZE = 1073741824;
const STRING_FORMAT_MAX_SIZES = new Map([
  ["email", 254],
  ["url", 2000],
  ["ip", 39],
  ["enum", 255],
]);
const COMMENT_MAX_UNICODE = 256;
const ENUM_ELEMENT_MAX_LENGTH = 255;
const FUNCTION_TIMEOUT_MIN = 1;
const FUNCTION_TIMEOUT_MAX = 900;
const ALLOWED_EXECUTE_ENTRIES = /^(?:any|users|team:[A-Za-z0-9_-]+)$/;

function unicodeLength(value) {
  return Array.from(value).length;
}

function isIsoDateTime(value) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/.exec(
      value
    );
  if (!match || Number.isNaN(Date.parse(value))) {
    return false;
  }
  const [year, month, day, hour, minute, second, offsetHour, offsetMinute] = [
    match[1],
    match[2],
    match[3],
    match[4],
    match[5],
    match[6],
    match[8],
    match[9],
  ].map((part) => Number(part || 0));
  const daysInMonth = [
    31,
    year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth[month - 1] &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59 &&
    offsetHour <= 23 &&
    offsetMinute <= 59
  );
}

function validateColumn(table, tablePath, column, columnKeys, columnTypeByKey) {
  const tableId = table.tableId;
  if (!isObject(column) || typeof column.key !== "string") {
    report(`${paths.schema}: ${tablePath} 存在无效 column`);
    return;
  }
  const { key } = column;
  if (!COLUMN_KEY_PATTERN.test(key)) {
    report(
      `${paths.schema}: table ${tableId} 的 column.key ${key} 必须匹配 ${COLUMN_KEY_PATTERN}`
    );
  }
  if (columnKeys.has(key)) {
    report(`${paths.schema}: table ${tableId} 的 column ${key} 重复`);
  }
  columnKeys.add(key);
  if (key.startsWith("$") || reservedColumns.has(key)) {
    report(`${paths.schema}: table ${tableId} 不得声明保留字段 ${key}`);
  }
  if (hasOwn(column, "required") && typeof column.required !== "boolean") {
    report(
      `${paths.schema}: table ${tableId} 的 column ${key} 的 required 必须是 boolean`
    );
  }
  for (const property of UNSUPPORTED_COLUMN_PROPERTIES) {
    if (hasOwn(column, property)) {
      report(
        `${paths.schema}: table ${tableId} 的 column ${key} 不得声明 ${property}`
      );
    }
  }
  const type = column.type;
  if (!ALLOWED_COLUMN_TYPES.has(type)) {
    if (type === "relationship") {
      report(
        `${paths.schema}: table ${tableId} 的 column ${key} 不得使用 relationship 类型；关联关系用普通 ID 字段`
      );
    } else if (type === undefined) {
      report(
        `${paths.schema}: table ${tableId} 的 column ${key} 缺少 type；允许类型为 string, integer, double, boolean, datetime`
      );
    } else {
      report(
        `${paths.schema}: table ${tableId} 的 column ${key} 的 type "${type}" 不在允许列表 (string, integer, double, boolean, datetime)`
      );
    }
    return;
  }
  columnTypeByKey.set(key, type);
  const hasFormat = hasOwn(column, "format");
  const format = hasFormat ? column.format : "";
  if (type === "datetime") {
    if (hasFormat && format !== "") {
      report(
        `${paths.schema}: table ${tableId} 的 column ${key} 是 datetime，不得设置 format`
      );
    }
    if (hasOwn(column, "size")) {
      report(
        `${paths.schema}: table ${tableId} 的 column ${key} 是 datetime，不得设置 size`
      );
    }
  } else if (type === "string") {
    if (hasFormat && format !== "" && !ALLOWED_STRING_FORMATS.has(format)) {
      report(
        `${paths.schema}: table ${tableId} 的 column ${key} 的 format "${format}" 不在允许列表 (email, enum, ip, url)；省略 format 表示普通字符串`
      );
      return;
    }
    const size = column.size;
    if (
      typeof size !== "number" ||
      !Number.isInteger(size) ||
      size < 1 ||
      size > STRING_MAX_SIZE
    ) {
      report(
        `${paths.schema}: table ${tableId} 的 column ${key} 是 string，size 必须是整数 1..${STRING_MAX_SIZE}`
      );
    }
    const formatMaxSize = STRING_FORMAT_MAX_SIZES.get(format);
    if (
      formatMaxSize !== undefined &&
      (typeof size !== "number" ||
        !Number.isInteger(size) ||
        size < 1 ||
        size > formatMaxSize)
    ) {
      report(
        `${paths.schema}: table ${tableId} 的 column ${key} 是 ${format}，size 必须是整数 1..${formatMaxSize}`
      );
    }
  } else {
    if (hasFormat && format !== "") {
      report(
        `${paths.schema}: table ${tableId} 的 column ${key} 是 ${type}，不得设置 format`
      );
    }
    if (hasOwn(column, "size")) {
      report(
        `${paths.schema}: table ${tableId} 的 column ${key} 是 ${type}，不得设置 size`
      );
    }
  }
  if (format === "enum") {
    const elements = column.elements;
    if (!Array.isArray(elements) || elements.length === 0) {
      report(
        `${paths.schema}: table ${tableId} 的 column ${key} 是 enum，必须提供非空 elements 数组`
      );
    } else {
      const seen = new Set();
      for (const element of elements) {
        if (typeof element !== "string" || element.length === 0) {
          report(
            `${paths.schema}: table ${tableId} 的 column ${key} 的 elements 项必须是非空字符串`
          );
          continue;
        }
        if (unicodeLength(element) > ENUM_ELEMENT_MAX_LENGTH) {
          report(
            `${paths.schema}: table ${tableId} 的 column ${key} 的 elements 项 ${element} 超过 ${ENUM_ELEMENT_MAX_LENGTH} 字符`
          );
        }
        if (seen.has(element)) {
          report(
            `${paths.schema}: table ${tableId} 的 column ${key} 的 elements 项 ${element} 重复`
          );
        }
        seen.add(element);
      }
      if (
        typeof column.size === "number" &&
        elements.some(
          (element) =>
            typeof element === "string" && unicodeLength(element) > column.size
        )
      ) {
        report(
          `${paths.schema}: table ${tableId} 的 column ${key} 的 enum size 不得小于最长 elements 项`
        );
      }
      if (hasOwn(column, "default")) {
        const defaultValue = column.default;
        if (typeof defaultValue !== "string" || !seen.has(defaultValue)) {
          report(
            `${paths.schema}: table ${tableId} 的 column ${key} 的 enum default 必须等于 elements 中的一个值`
          );
        }
      }
    }
  }
  if (column.required === true && hasOwn(column, "default")) {
    report(
      `${paths.schema}: table ${tableId} 的 column ${key} required:true 不得同时设 default`
    );
  }
  if (hasOwn(column, "default") && column.default === null) {
    report(
      `${paths.schema}: table ${tableId} 的 column ${key} 的 default 为 null 时必须省略 default`
    );
  }
  if (
    hasOwn(column, "default") &&
    column.default !== undefined &&
    column.default !== null
  ) {
    const defaultValue = column.default;
    switch (type) {
      case "string":
        if (typeof defaultValue !== "string") {
          report(
            `${paths.schema}: table ${tableId} 的 column ${key} 的 string default 必须是字符串`
          );
        } else if (
          typeof column.size === "number" &&
          unicodeLength(defaultValue) > column.size
        ) {
          report(
            `${paths.schema}: table ${tableId} 的 column ${key} 的 string default 长度不得超过 size`
          );
        }
        if (format === "email" && !EMAIL_REGEX.test(defaultValue)) {
          report(
            `${paths.schema}: table ${tableId} 的 column ${key} 的 default 不符合 email 格式`
          );
        }
        if (format === "url" && !URL_REGEX.test(defaultValue)) {
          report(
            `${paths.schema}: table ${tableId} 的 column ${key} 的 default 不符合 url 格式`
          );
        }
        if (format === "ip" && isIP(defaultValue) === 0) {
          report(
            `${paths.schema}: table ${tableId} 的 column ${key} 的 default 不符合 IPv4/IPv6 格式`
          );
        }
        break;
      case "integer":
        if (
          typeof defaultValue !== "number" ||
          !Number.isInteger(defaultValue)
        ) {
          report(
            `${paths.schema}: table ${tableId} 的 column ${key} 的 integer default 必须是 JSON 整数`
          );
        }
        break;
      case "double":
        if (typeof defaultValue !== "number") {
          report(
            `${paths.schema}: table ${tableId} 的 column ${key} 的 double default 必须是数字`
          );
        }
        break;
      case "boolean":
        if (typeof defaultValue !== "boolean") {
          report(
            `${paths.schema}: table ${tableId} 的 column ${key} 的 boolean default 必须是 JSON boolean`
          );
        }
        break;
      case "datetime":
        if (typeof defaultValue !== "string" || !isIsoDateTime(defaultValue)) {
          report(
            `${paths.schema}: table ${tableId} 的 column ${key} 的 datetime default 必须是 ISO 8601 字符串`
          );
        }
        break;
      default:
        break;
    }
  }
  if (hasOwn(column, "comment") && column.comment !== undefined) {
    const comment = column.comment;
    if (typeof comment !== "string") {
      report(
        `${paths.schema}: table ${tableId} 的 column ${key} 的 comment 必须是字符串`
      );
    } else if (unicodeLength(comment.trim()) > COMMENT_MAX_UNICODE) {
      report(
        `${paths.schema}: table ${tableId} 的 column ${key} 的 comment trim 后超过 ${COMMENT_MAX_UNICODE} Unicode 字符`
      );
    }
  }
}

function validateIndex(table, tablePath, index, indexKeys, columnTypeByKey) {
  const tableId = table.tableId;
  if (!isObject(index) || typeof index.key !== "string") {
    report(`${paths.schema}: ${tablePath} 存在无效 index`);
    return;
  }
  const { key } = index;
  if (!COLUMN_KEY_PATTERN.test(key)) {
    report(
      `${paths.schema}: table ${tableId} 的 index.key ${key} 必须匹配 ${COLUMN_KEY_PATTERN}`
    );
  }
  if (indexKeys.has(key)) {
    report(`${paths.schema}: table ${tableId} 的 index ${key} 重复`);
  }
  indexKeys.add(key);
  const indexType = index.type;
  if (!ALLOWED_INDEX_TYPES.has(indexType)) {
    report(
      `${paths.schema}: table ${tableId} 的 index ${key} 的 type "${indexType}" 不在允许列表 (key, unique, fulltext)`
    );
  }
  if (!Array.isArray(index.attributes) || index.attributes.length === 0) {
    report(
      `${paths.schema}: table ${tableId} 的 index ${key} 的 attributes 必须是非空数组`
    );
    return;
  }
  const seenAttributes = new Set();
  for (const attribute of index.attributes) {
    if (!isNonEmptyString(attribute)) {
      report(
        `${paths.schema}: table ${tableId} 的 index ${key} 的 attributes 每项必须是非空字符串`
      );
      continue;
    }
    if (seenAttributes.has(attribute)) {
      report(
        `${paths.schema}: table ${tableId} 的 index ${key} 的 attributes 不得重复引用 ${attribute}`
      );
    }
    seenAttributes.add(attribute);
    if (forbiddenIndexAttributes.has(attribute)) {
      report(
        `${paths.schema}: table ${tableId} 的 index ${key} 不得引用 ${attribute}`
      );
    }
    if (!columnTypeByKey.has(attribute)) {
      report(
        `${paths.schema}: table ${tableId} 的 index ${key} 引用了未声明列 ${attribute}`
      );
    }
    if (indexType === "fulltext") {
      const attributeType = columnTypeByKey.get(attribute);
      if (attributeType !== undefined && attributeType !== "string") {
        report(
          `${paths.schema}: table ${tableId} 的 fulltext index ${key} 只能引用 string 列，${attribute} 不是 string`
        );
      }
    }
  }
  if (hasOwn(index, "orders")) {
    const orders = index.orders;
    if (
      !Array.isArray(orders) ||
      orders.length !== index.attributes.length ||
      !orders.every((o) => o === "ASC" || o === "DESC")
    ) {
      report(
        `${paths.schema}: table ${tableId} 的 index ${key} 的 orders 必须与 attributes 等长数组，每项 ASC 或 DESC`
      );
    }
  }
  if (hasOwn(index, "lengths")) {
    report(
      `${paths.schema}: table ${tableId} 的 index ${key} 不得声明 lengths`
    );
  }
}

function validateFunctionDecl(fn) {
  const functionId = fn.functionId;
  if (typeof functionId !== "string" || !FUNCTION_ID_PATTERN.test(functionId)) {
    report(
      `${paths.schema}: function ${functionId} 的 functionId 必须匹配 ${FUNCTION_ID_PATTERN}`
    );
  }
  const label = typeof functionId === "string" ? functionId : "<missing>";
  if (!isNonEmptyString(fn.name)) {
    report(`${paths.schema}: function ${label} 的 name 必须是非空字符串`);
  }
  if (hasOwn(fn, "runtime") && !FUNCTION_RUNTIME_PATTERN.test(fn.runtime)) {
    report(
      `${paths.schema}: function ${label} 的 runtime "${fn.runtime}" 不在允许列表`
    );
  }
  if (
    hasOwn(fn, "timeout") &&
    (typeof fn.timeout !== "number" ||
      !Number.isInteger(fn.timeout) ||
      fn.timeout < FUNCTION_TIMEOUT_MIN ||
      fn.timeout > FUNCTION_TIMEOUT_MAX)
  ) {
    report(
      `${paths.schema}: function ${label} 的 timeout 必须是整数 ${FUNCTION_TIMEOUT_MIN}..${FUNCTION_TIMEOUT_MAX}`
    );
  }
  if (hasOwn(fn, "execute")) {
    const execute = fn.execute;
    if (
      !Array.isArray(execute) ||
      execute.length === 0 ||
      !execute.every((entry) => ALLOWED_EXECUTE_ENTRIES.test(entry))
    ) {
      report(
        `${paths.schema}: function ${label} 的 execute 必须是非空数组，每项为 any、users 或 team:<id>`
      );
    }
  }
  if (
    !Array.isArray(fn.scopes) ||
    fn.scopes.length === 0 ||
    !fn.scopes.every((s) => typeof s === "string" && s.length > 0)
  ) {
    report(`${paths.schema}: function ${label} 的 scopes 必须是非空字符串数组`);
  }
  if (
    typeof fn.path !== "string" ||
    !fn.path.startsWith("functions/") ||
    fn.path.includes("..")
  ) {
    report(
      `${paths.schema}: function ${label} 的 path 必须以 functions/ 开头且不含 ..`
    );
  }
  if (hasOwn(fn, "memorySize")) {
    report(
      `${paths.schema}: function ${label} 不得声明 memorySize；当前部署链路不会应用`
    );
  }
  if (hasOwn(fn, "variables") || hasOwn(fn, "secret")) {
    report(`${paths.schema}: function ${label} 不得声明 variables 或 secret`);
  }
}

if (isObject(schema)) {
  if (!isNonEmptyString(schema.databaseId)) {
    report(`${paths.schema}: databaseId 必须是非空字符串`);
  }
  if (!Array.isArray(schema.tables) || schema.tables.length === 0) {
    report(`${paths.schema}: tables 必须是非空数组`);
  } else {
    const tableIds = new Set();
    for (const [tableIndex, table] of schema.tables.entries()) {
      const tablePath = `tables[${tableIndex}]`;
      if (!isObject(table)) {
        report(`${paths.schema}: ${tablePath} 必须是对象`);
        continue;
      }
      if (!isNonEmptyString(table.tableId)) {
        report(`${paths.schema}: ${tablePath}.tableId 必须是非空字符串`);
      } else if (!schemaIdentifierPattern.test(table.tableId)) {
        report(
          `${paths.schema}: ${tablePath}.tableId ${table.tableId} 必须匹配 ${schemaIdentifierPattern}`
        );
      } else if (tableIds.has(table.tableId)) {
        report(`${paths.schema}: tableId ${table.tableId} 重复`);
      } else {
        tableIds.add(table.tableId);
      }
      if (!isNonEmptyString(table.name)) {
        report(
          `${paths.schema}: ${tablePath}.name 必须是非空字符串，表级 comment 不能替代 name`
        );
      }
      for (const key of ["permissions", "rowSecurity", "sampleRows"]) {
        if (hasOwn(table, key)) {
          report(`${paths.schema}: table ${table.tableId} 不得声明 ${key}`);
        }
      }
      if (!Array.isArray(table.columns)) {
        report(`${paths.schema}: table ${table.tableId} 的 columns 必须是数组`);
      } else {
        const columnKeys = new Set();
        const columnTypeByKey = new Map();
        for (const column of table.columns) {
          validateColumn(table, tablePath, column, columnKeys, columnTypeByKey);
        }
        if (table.indexes !== undefined && !Array.isArray(table.indexes)) {
          report(
            `${paths.schema}: table ${table.tableId} 的 indexes 必须是数组`
          );
        }
        const indexKeys = new Set();
        for (const index of Array.isArray(table.indexes) ? table.indexes : []) {
          validateIndex(table, tablePath, index, indexKeys, columnTypeByKey);
        }
      }
    }
  }
  if (hasOwn(schema, "functions")) {
    if (!Array.isArray(schema.functions) || schema.functions.length === 0) {
      report(`${paths.schema}: 不使用云函数时必须省略 functions 字段`);
    } else {
      for (const fn of schema.functions) {
        if (!isObject(fn)) {
          report(`${paths.schema}: function 必须是对象`);
          continue;
        }
        validateFunctionDecl(fn);
      }
    }
  }
} else if (schema !== null) {
  report(`${paths.schema}: 必须是 JSON 对象`);
}

validateFunctionSecretConsumption(schema);

const sourceRoot = path.join(projectRoot, "src");
const service = readText(paths.service);
if (service !== null) {
  const usesRuntimeSdk =
    /(?:from\s+|require\s*\()\s*["']@qmuse\/appwrite-runtime-sdk["']/.test(
      service
    );
  validateSourceRules(service, paths.service, {
    forbidden: [
      [/\bdeclare\s+global\b/, "不得生成 declare global"],
      [/\binterface\s+Window\b/, "不得扩展 Window"],
      [/\bwindow\s*\.\s*__MUSE__\s*=/, "不得赋值 window.__MUSE__"],
    ],
  });
  if (
    /\b(?:async\s+)?function\s+use[A-Z][A-Za-z0-9_$]*\s*\(/.test(service) ||
    /\b(?:const|let|var)\s+use[A-Z][A-Za-z0-9_$]*\s*=/.test(service)
  ) {
    report(`${paths.service}: 非 React Hook 的 helper 不得以 useXxx 命名`);
  }
  if (usesRuntimeSdk) {
    validateSourceRules(service, paths.service, RUNTIME_SERVICE_RULES);
    validateSourceRules(service, paths.service, WEB_SERVICE_RULES);
  } else {
    requireCredentialedFetch(service, "/runtime/appwrite/config", [
      /\/runtime\/appwrite\/config/,
    ]);
    requireCredentialedFetch(service, "custom-token", [
      /\bauthTokenEndpoint\b/,
      /\/runtime\/appwrite\/auth\/custom-token/,
    ]);
  }

  const hasBrowserFunctionsClient = /\bnew\s+Functions\s*\(/.test(service);
  if (hasBrowserFunctionsClient) {
    if (!/\bexecuteQmuseFunction\b/.test(service)) {
      report(
        `${paths.service}: 浏览器调用云函数时必须导出 executeQmuseFunction() 统一 helper`
      );
    }
    if (
      /\bexport\s+(?:const|let|var)\s+functions\b/.test(service) ||
      /\bexport\s*\{[^}]*\bfunctions\b[^}]*\}/s.test(service)
    ) {
      report(
        `${paths.service}: 原始 Functions 单例必须保持模块私有，只导出 executeQmuseFunction()`
      );
    }
    if (
      /\bParameters\s*<\s*Functions\s*\[\s*["']createExecution["']\s*\]\s*>\s*\[\s*0\s*\]/.test(
        service
      )
    ) {
      report(
        `${paths.service}: createExecution 存在对象和位置参数重载，不得用 Parameters<Functions["createExecution"]>[0] 提取对象入参`
      );
    }
    if (/\bExecutionMethod\b|\bmethod\s*\?\s*:/.test(service)) {
      report(
        `${paths.service}: executeQmuseFunction() 统一使用 Appwrite 默认 POST，不得暴露 method 或 ExecutionMethod`
      );
    }
  }
  if (!usesRuntimeSdk) {
    const clientsFunctionStart = service.indexOf("getAppwriteClients");
    const clientsFunctionSnippet =
      clientsFunctionStart >= 0
        ? service.slice(clientsFunctionStart, clientsFunctionStart + 1600)
        : "";
    if (!/\bdatabaseId\b/.test(clientsFunctionSnippet)) {
      report(`${paths.service}: getAppwriteClients() 必须返回 databaseId`);
    }
  }

  if (/\bwindow\s*\.\s*__TERN__\b/.test(service)) {
    const runtimeTypeFiles = walkFiles(sourceRoot).filter((absolutePath) =>
      absolutePath.endsWith(".d.ts")
    );
    const hasRuntimeType = runtimeTypeFiles.some((absolutePath) => {
      const content = fs.readFileSync(absolutePath, "utf8");
      return (
        /\binterface\s+Window\b/.test(content) &&
        /\b__MUSE__\b/.test(content) &&
        /\b__TERN__\s*(?:\?|:)/.test(content)
      );
    });
    if (!hasRuntimeType) {
      report(
        "src/types/global.d.ts: 请在声明 __MUSE__ 的现有 Window 接口中声明 __TERN__ 类型"
      );
    }
  }
}

for (const absolutePath of walkFiles(sourceRoot)) {
  if (!/\.[cm]?[jt]sx?$/.test(absolutePath)) {
    continue;
  }
  const relativePath = path.relative(projectRoot, absolutePath);
  const content = fs.readFileSync(absolutePath, "utf8");
  // The infrastructure facade is not exempt from file mutation restrictions.
  validateFileMutations(relativePath, content);
  if (relativePath !== paths.service) {
    const { code, strings } = analyzeSource(content);
    if (/\bnew\s+(?:Client|Account|Storage|TablesDB)\s*\(/.test(content)) {
      report(`${relativePath}: Appwrite SDK 只能在 ${paths.service} 创建`);
    }
    if (/\btablesDB\s*\.\s*listRows\s*\(/.test(code)) {
      report(
        `${relativePath}: 列表查询必须通过 ${paths.service} 的 listQmuseRows() 调用`
      );
    }
    if (/\.\s*(?:createRow|updateRow)\s*\(/.test(content)) {
      report(
        `${relativePath}: createRow/updateRow 必须通过 ${paths.service} 的 helper 调用`
      );
    }
    if (
      content.includes("listQmuseRows") &&
      strings.some((value) => HAND_WRITTEN_APPWRITE_QUERY_PATTERN.test(value))
    ) {
      report(
        `${relativePath}: 查询条件必须使用 appwrite.ts 导出的 Query 构造器，不得手写 Appwrite 查询字符串`
      );
    }
    if (
      content.includes("listQmuseRows") &&
      RUNTIME_OWNED_QUERY_PATTERN.test(code)
    ) {
      report(
        `${relativePath}: listQmuseRows 的排序和分页由 Runtime SDK 统一处理；请使用顶层 limit、cursor 参数，不得在 queries 中传 Query.order*、Query.limit、Query.offset 或 Query.cursor*`
      );
    }
    if (/\.\s*createExecution\s*\(/.test(content)) {
      report(
        `${relativePath}: 云函数必须通过 ${paths.service} 的 executeQmuseFunction() 调用`
      );
    }
    if (
      /\b(?:appwriteStorage|fileStorage)\s*\.\s*(?:createFile|listFiles|getFile|getFileView|getFilePreview|getFileDownload)\s*\(/.test(
        code
      )
    ) {
      report(
        `${relativePath}: 文件必须通过 ${paths.service} 的文件 facade 调用，不得直接使用 Storage 或传入 bucketId`
      );
    }
    if (
      /\.\s*updateColumnComment\s*\(/.test(content) ||
      /\.\s*aggregateRows\s*\(/.test(content)
    ) {
      report(
        `${relativePath}: 不得调用 updateColumnComment 或 aggregateRows；当前 SDK 未导出`
      );
    }
    if (
      /(?:from\s+|require\s*\()\s*["'](?:appwrite|@qmuse\/appwrite-runtime-sdk)["']/.test(
        content
      )
    ) {
      report(
        `${relativePath}: 业务代码不得直接导入 appwrite 或 @qmuse/appwrite-runtime-sdk，必须通过领域 Service 和 ${paths.service} 的 facade 访问`
      );
    }
  }
  if (
    /(?:from\s+|require\s*\()\s*["']node-appwrite["']/.test(content) ||
    /\.setKey\s*\(/.test(content)
  ) {
    report(`${relativePath}: 浏览器代码不得使用 node-appwrite 或 API Key`);
  }
}

if (errors.length > 0) {
  console.error(`QMuse Appwrite 产物校验失败（${errors.length} 项）：`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
} else {
  console.log("QMuse Appwrite 产物校验通过");
}
