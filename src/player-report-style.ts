import registry from "../data/player-report-styles.json";
export type ReportStyle = "commander" | "analysis" | "roast" | "custom";
export const reportStyles = registry.styles;
export const reportStyle = (id?: string) =>
  reportStyles.find((style) => style.id === id) || reportStyles[0];
