import { decodeCsv } from "./country-csv.mjs";
import type { DataFile } from "./data-loader";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
export function decodeCountryResource(csv: string, entry: DataFile) {
  const bytes = new TextEncoder().encode(csv);
  if (bytes.length !== entry.bytes || bytesToHex(sha256(bytes)) !== entry.sha256)
    throw Error("国家CSV资料校验失败");
  return decodeCsv(csv);
}
