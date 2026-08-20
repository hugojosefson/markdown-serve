export const pageClient = `
const tree = document.querySelector('.tree');
tree?.addEventListener('click', (event) => {
  if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) { return; }
  const link = event.target.closest?.('details[data-path] > summary > .tree-folder-link');
  const details = link?.closest?.('details[data-path]');
  if (!details || new URL(link.href, location.href).pathname !== location.pathname || new URLSearchParams(location.search).has('dir')) { return; }
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
  const filesLink = document.createElement('a');
  filesLink.className = 'tree-files-link';
  filesLink.href = entry.filesHref;
  filesLink.title = filesLink.ariaLabel = 'Show files in ' + entry.name;
  filesLink.textContent = 'Files';
  syncNavigationLinks([link, filesLink]);
  const details = document.createElement('details');
  details.dataset.path = entry.path;
  const summary = document.createElement('summary');
  summary.append(link, filesLink);
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
