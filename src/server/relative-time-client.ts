export const relativeTimeClient = `
const relativeTimeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const relativeTimePart = (difference) => {
  const ranges = [[60, 'second'], [60, 'minute'], [24, 'hour'], [7, 'day'], [4.345, 'week'], [12, 'month'], [Infinity, 'year']];
  let value = difference / 1000, scale = 1000, lowerBoundary = 0;
  for (const [range, unit] of ranges) {
    if (Math.abs(value) < range) { return { value, range, unit, scale, lowerBoundary }; }
    value /= range; lowerBoundary = scale * range; scale *= range;
  }
};
const relativeTimeDelay = (difference) => {
  const { value, range, scale, lowerBoundary } = relativeTimePart(difference);
  const amount = Math.abs(value);
  const boundary = difference <= 0 ? Math.min((Math.floor(amount - .5) + 1.5) * scale, range * scale) : Math.max((Math.floor(amount - .5) + .5) * scale, lowerBoundary);
  if (difference > 0 && boundary === 0) { return Math.ceil(difference + 510); }
  return Math.max(10, Math.ceil((difference <= 0 ? boundary - Math.abs(difference) : Math.abs(difference) - boundary) + 10));
};
let relativeTimeTimer;
const maximumRelativeTimeDelay = 2147483647;
const updateRelativeTimes = () => {
  if (document.hidden) { return; }
  const now = Date.now(); let next = Infinity;
  document.querySelectorAll('[data-relative-time]').forEach((element) => {
    const difference = new Date(element.dataset.relativeTime).getTime() - now;
    const { value, unit } = relativeTimePart(difference);
    element.textContent = relativeTimeFormatter.format(Math.round(value), unit);
    next = Math.min(next, relativeTimeDelay(difference));
  });
  if (next < Infinity) { relativeTimeTimer = setTimeout(updateRelativeTimes, Math.min(next, maximumRelativeTimeDelay)); }
};
const refreshRelativeTimes = () => {
  clearTimeout(relativeTimeTimer);
  if (!document.hidden) { updateRelativeTimes(); }
};
document.addEventListener('visibilitychange', refreshRelativeTimes);
updateRelativeTimes();`;
