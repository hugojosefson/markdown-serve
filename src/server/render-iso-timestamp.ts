export function renderIsoTimestamp(date: Date): string {
  const value = date.toISOString();
  return `<time datetime="${value}" aria-label="${value}">${
    value.replace(
      /[-T:.Z]/g,
      (separator) =>
        `<span class="timestamp-separator${
          separator === "T" ? " timestamp-t" : ""
        }${separator === "Z" ? " timestamp-zone" : ""}">${separator}</span>`,
    )
  }</time>`;
}
