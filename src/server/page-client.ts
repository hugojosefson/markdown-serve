export const pageClient = `
const tree = document.querySelector('.tree');
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
  if (entry.filesHref) {
    const filesLink = document.createElement('a');
    filesLink.className = 'tree-files-link';
    filesLink.href = entry.filesHref;
    filesLink.title = filesLink.ariaLabel = 'Show files in ' + entry.name;
    filesLink.textContent = 'Files';
    summary.append(filesLink);
    syncNavigationLinks([link, filesLink]);
  } else { syncNavigationLinks([link]); }
  details.append(summary, document.createElement('ul'));
  item.append(details); list.append(item);
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
