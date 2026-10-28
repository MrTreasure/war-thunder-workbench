/** Typed CSV relation table. Fixed columns, object-shape dictionary and shared subtrees.
 * Inline scalars preserve null, boolean, number and string types without JSON cells. */
const cell = (value) => (/[",\r\n]/.test(value) ? '"' + value.replaceAll('"', '""') + '"' : value);
export function encodeCsv(value) {
  const rows = ["type,id,value"],
    keys = new Map(),
    objects = new Map();
  let next = 0;
  const row = (type, id, text) => rows.push(`${type},${id},${cell(text)}`);
  function shape(names) {
    const name = names.map(encodeURIComponent).join("|");
    if (!keys.has(name)) {
      const id = keys.size;
      keys.set(name, id);
      row("k", id, name);
    }
    return keys.get(name);
  }
  function reference(item) {
    if (item === null) return "z";
    if (typeof item === "boolean") return item ? "t" : "f";
    if (typeof item === "number") {
      if (!Number.isFinite(item)) throw Error("CSV contains nonfinite number");
      return "n" + item;
    }
    if (typeof item === "string") return "s" + item.replaceAll("%", "%25").replaceAll("|", "%7C");
    if (!item || typeof item !== "object") throw Error("Unsupported CSV value");
    const signature = JSON.stringify(item);
    if (objects.has(signature)) return objects.get(signature);
    const array = Array.isArray(item);
    const names = array ? [] : Object.keys(item).sort();
    const values = array
      ? item.map(reference)
      : [shape(names), ...names.map((name) => reference(item[name]))];
    const id = next++;
    row(array ? "a" : "o", id, values.join("|"));
    const token = (array ? "a" : "o") + id;
    objects.set(signature, token);
    return token;
  }
  row("r", 0, reference(value));
  return rows.join("\r\n") + "\r\n";
}
export function decodeCsv(text) {
  if (
    typeof text !== "string" ||
    text.length > 64 * 1024 * 1024 ||
    !text.startsWith("type,id,value\r\n")
  )
    throw Error("CSV header invalid");
  const keys = new Map(),
    nodes = new Map();
  let root,
    cursor = 15,
    count = 0;
  function field() {
    let result = "";
    if (text[cursor] === '"') {
      cursor++;
      while (cursor < text.length) {
        const quote = text.indexOf('"', cursor);
        if (quote < 0) throw Error("Unclosed CSV quote");
        result += text.slice(cursor, quote);
        cursor = quote + 1;
        if (text[cursor] === '"') {
          result += '"';
          cursor++;
        } else break;
      }
    } else {
      const start = cursor;
      while (cursor < text.length && ![",", "\r", "\n"].includes(text[cursor])) cursor++;
      result = text.slice(start, cursor);
    }
    return result;
  }
  while (cursor < text.length) {
    if (++count > 2_000_000) throw Error("CSV record limit");
    const type = field();
    if (text[cursor++] !== ",") throw Error("CSV columns invalid");
    const id = field();
    if (text[cursor++] !== ",") throw Error("CSV columns invalid");
    const value = field();
    if (text.slice(cursor, cursor + 2) !== "\r\n") throw Error("CSV record ending invalid");
    cursor += 2;
    if (!/^(0|[1-9][0-9]*)$/.test(id)) throw Error("CSV id invalid");
    const index = Number(id);
    if (!Number.isSafeInteger(index)) throw Error("CSV id invalid");
    if (type === "k") {
      if (keys.has(index)) throw Error("Duplicate CSV property");
      keys.set(index, value);
    } else if (type === "r") {
      if (root !== undefined || index !== 0) throw Error("Duplicate CSV root");
      root = value;
    } else if (["o", "a"].includes(type)) {
      if (nodes.has(index)) throw Error("Duplicate CSV node");
      nodes.set(index, { type, value });
    } else throw Error("CSV type invalid");
  }
  const resolved = new Map(),
    active = new Set();
  function resolve(token, depth = 0) {
    if (depth > 80) throw Error("CSV nesting limit");
    if (token === "z") return null;
    if (token === "t") return true;
    if (token === "f") return false;
    if (token?.[0] === "s")
      return token.slice(1).replace(/%7C|%25/g, (part) => (part === "%7C" ? "|" : "%"));
    if (token?.[0] === "n") {
      const n = Number(token.slice(1));
      if (
        !/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(token.slice(1)) ||
        !Number.isFinite(n)
      )
        throw Error("CSV number invalid");
      return n;
    }
    if (!/^[oa](0|[1-9]\d*)$/.test(token || "")) throw Error("CSV reference invalid");
    const id = Number(token.slice(1)),
      node = nodes.get(id);
    if (!node || node.type !== token[0] || active.has(id)) throw Error("CSV relationship invalid");
    if (resolved.has(id)) return resolved.get(id);
    active.add(id);
    const result = node.type === "a" ? [] : {};
    const values = node.value ? node.value.split("|") : [];
    if (node.type === "a") for (const part of values) result.push(resolve(part, depth + 1));
    else {
      const keyId = values.shift();
      if (!/^(0|[1-9]\d*)$/.test(keyId) || !keys.has(Number(keyId)))
        throw Error("CSV shape invalid");
      const encoded = keys.get(Number(keyId));
      const names = encoded ? encoded.split("|").map(decodeURIComponent) : [];
      if (names.length !== values.length) throw Error("CSV shape mismatch");
      for (let i = 0; i < names.length; i++) {
        const name = names[i];
        if (Object.hasOwn(result, name)) throw Error("CSV repeated property");
        Object.defineProperty(result, name, {
          value: resolve(values[i], depth + 1),
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
    }
    active.delete(id);
    resolved.set(id, result);
    return result;
  }
  return resolve(root);
}
/** Global check timestamps are metadata, never a reason to invalidate another country. */
export function countryBody(payload) {
  const { checkedAt: _checkedAt, sources: _sources, ...body } = payload;
  return body;
}
export function restoreCountry(body, metadata) {
  if (!body || typeof body !== "object") throw Error("CSV country missing");
  return { ...body, checkedAt: metadata.checkedAt, sources: metadata.sources };
}
