export const directoryTableClient = `
const directoryListenerOptions = typeof pageSignal === 'undefined' ? {} : { signal: pageSignal };
const directoryColumnCandidates = [
  '',
  'git',
  'git user',
  'git user permissions',
  'git user permissions modified',
  'git user permissions modified size',
];
const compactDirectoryColumnCandidates = [
  'git user permissions modified',
  'git user permissions modified size',
];
const directoryNavigation = document.querySelector('.tree');
const fitDirectoryColumns = (container) => {
  const table = container.querySelector('.directory-table');
  if (!table) { return; }
  const candidates = directoryNavigation && getComputedStyle(directoryNavigation).display === 'none'
    ? compactDirectoryColumnCandidates
    : directoryColumnCandidates;
  for (const hidden of candidates) {
    table.dataset.hiddenColumns = hidden;
    if (table.scrollWidth <= container.clientWidth + 1) { return; }
  }
};
const directoryTableContainers = document.querySelectorAll('.directory-scroll');
directoryTableContainers.forEach(fitDirectoryColumns);
let directoryTableObserver;
if (typeof ResizeObserver === 'function') {
  directoryTableObserver = new ResizeObserver((entries) =>
    entries.forEach((entry) => fitDirectoryColumns(entry.target)));
  directoryTableContainers.forEach((container) => directoryTableObserver.observe(container));
} else {
  addEventListener('resize', () => directoryTableContainers.forEach(fitDirectoryColumns), directoryListenerOptions);
}`;
