export const pageClient = `
const tree = document.querySelector('.tree');
const pendingIndexes = [];
let runningIndexes = 0;
const addFilesLink = (details, href, name) => {
  if (details.querySelector('.tree-files-link')) { return; }
  const filesLink = document.createElement('a');
  filesLink.className = 'tree-files-link';
  filesLink.href = href;
  filesLink.title = filesLink.ariaLabel = 'Show files in ' + name;
  filesLink.textContent = 'Files';
  details.querySelector('summary').append(filesLink);
  syncNavigationLinks([filesLink]);
};
const runIndexes = () => {
  while (runningIndexes < 4 && pendingIndexes.length) {
    const details = pendingIndexes.shift();
    runningIndexes++;
    fetch('/__markdown_server__/index?path=' + encodeURIComponent(details.dataset.path))
      .then((response) => response.ok ? response.json() : undefined)
      .then((status) => { if (status?.filesHref) { addFilesLink(details, status.filesHref, details.querySelector('.tree-folder-link').textContent.slice(0, -1)); } })
      .catch(() => {})
      .finally(() => { details.dataset.indexPending = 'done'; runningIndexes--; runIndexes(); });
  }
};
const queueIndex = (details) => {
  if (details.dataset.indexPending !== 'true') { return; }
  details.dataset.indexPending = 'queued'; pendingIndexes.push(details); runIndexes();
};
tree?.querySelectorAll?.('details[data-index-pending="true"]').forEach(queueIndex);
const navigationLocationKey = (value) => {
  const url = new URL(value, location.href);
  const query = [...url.searchParams].map((pair) => JSON.stringify(pair)).sort().join(',');
  return JSON.stringify([url.origin, url.pathname, query]);
};
tree?.addEventListener('click', (event) => {
  if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) { return; }
  const link = event.target.closest?.('details[data-path] > summary > .tree-folder-link, details[data-path] > summary > .tree-files-link');
  const details = link?.closest?.('details[data-path]');
  if (!details || navigationLocationKey(link.href) !== navigationLocationKey(location.href)) { return; }
  event.preventDefault();
  details.open = !details.open;
});
const addEntries = (list, entries) => entries.forEach((entry) => {
  const item = document.createElement('li');
  const link = document.createElement('a');
  if (entry.directory) { link.className = 'tree-folder-link'; }
  link.href = entry.href;
  if (entry.queryRemove) { link.dataset.queryRemove = entry.queryRemove.join(' '); }
  link.textContent = entry.name + (entry.directory ? '/' : '');
  if (!entry.directory) { syncNavigationLinks([link]); item.append(link); list.append(item); return; }
  const details = document.createElement('details');
  details.dataset.path = entry.path;
  const summary = document.createElement('summary');
  summary.append(link);
  details.append(summary, document.createElement('ul'));
  if (entry.filesHref) { addFilesLink(details, entry.filesHref, entry.name); }
  syncNavigationLinks([link]);
  if (entry.indexPending) { details.dataset.indexPending = 'true'; }
  item.append(details); list.append(item); queueIndex(details);
});
tree?.addEventListener('toggle', async (event) => {
  const details = event.target;
  if (!(details instanceof HTMLDetailsElement) || !details.matches('[data-path]') ||
    !details.open || details.dataset.loaded === 'true') { return; }
  const response = await fetch('/__markdown_server__/tree?path=' +
    encodeURIComponent(details.dataset.path));
  if (!response.ok) { return; }
  addEntries(details.querySelector('ul'), await response.json());
  details.dataset.loaded = 'true';
}, true);`;
