/** Keep historical pricing metadata out of display notes without changing records. */
export function priceDisplayNote(value: string | null | undefined): string {
  return (value || "")
    .split(/(?<=[。！？；;\n])/u)
    .filter(
      (sentence) => !/人民币|\bCNY\b|\bRMB\b|[¥￥]|汇率|exchange\s+rate|renminbi/i.test(sentence),
    )
    .join("")
    .trim();
}
