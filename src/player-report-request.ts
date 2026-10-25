import type { ReportStyle } from "./player-report-style";
/** One request contract for PC and miniapp; report data, scoring and prose stay server-side. */
export function buildReportRequest(
  input: {
    snapshotId: string;
    mode: string;
    country: string;
    category: string;
    style: ReportStyle;
    customStyle: string;
  },
  requestId = "report_" + crypto.randomUUID(),
) {
  return { ...input, customStyle: input.style === "custom" ? input.customStyle : "", requestId };
}
