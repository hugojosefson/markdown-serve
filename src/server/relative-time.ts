const ranges: readonly [number, Intl.RelativeTimeFormatUnit][] = [
  [60, "second"],
  [60, "minute"],
  [24, "hour"],
  [7, "day"],
  [4.345, "week"],
  [12, "month"],
  [Infinity, "year"],
];

const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function formatRelativeTime(date: Date, now = new Date()): string {
  const { value, unit } = relativeTimePart(date.getTime() - now.getTime());
  return formatter.format(Math.round(value), unit);
}

export function relativeTimeUpdateDelay(date: Date, now = new Date()): number {
  const difference = date.getTime() - now.getTime();
  const { value, range, scale, lowerBoundary } = relativeTimePart(difference);
  const amount = Math.abs(value);
  const boundary = difference <= 0
    ? Math.min((Math.floor(amount - 0.5) + 1.5) * scale, range * scale)
    : Math.max((Math.floor(amount - 0.5) + 0.5) * scale, lowerBoundary);
  if (difference > 0 && boundary === 0) {
    return Math.ceil(difference + 510);
  }
  const delay = difference <= 0
    ? boundary - Math.abs(difference)
    : Math.abs(difference) - boundary;
  return Math.max(10, Math.ceil(delay + 10));
}

function relativeTimePart(difference: number) {
  let value = difference / 1_000;
  let scale = 1_000;
  let lowerBoundary = 0;
  for (const [range, unit] of ranges) {
    if (Math.abs(value) < range) {
      return { value, unit, range, scale, lowerBoundary };
    }
    value /= range;
    lowerBoundary = scale * range;
    scale *= range;
  }
  return {
    value: 0,
    unit: "year" as const,
    range: Infinity,
    scale,
    lowerBoundary,
  };
}
