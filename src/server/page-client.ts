export const pageClient = `
const tree = document.querySelector('.tree');
const treeDisclosure = tree?.querySelector?.('.tree-disclosure');
const narrowTree = globalThis.matchMedia?.('(max-width: 560px)');
const syncTreeDisclosure = (event) => { if (treeDisclosure) { treeDisclosure.open = !event.matches; } };
if (narrowTree) {
  syncTreeDisclosure(narrowTree);
  narrowTree.addEventListener?.('change', syncTreeDisclosure);
}
const filesLink = (href, name) => {
  const filesLink = document.createElement('a');
  filesLink.className = 'tree-files-link';
  filesLink.href = href;
  filesLink.dataset.queryScope = 'directory';
  filesLink.title = filesLink.ariaLabel = 'Show files in ' + name;
  filesLink.textContent = 'Files';
  return filesLink;
};
const navigationLocationKey = (value) => {
  const url = new URL(value, location.href);
  const query = [...url.searchParams].map((pair) => JSON.stringify(pair)).sort().join(',');
  return JSON.stringify([url.origin, url.pathname, query]);
};
document.querySelectorAll('.media-preview.image').forEach((image) => {
  const constrain = () => { if (image.naturalWidth) { image.style.setProperty('--image-max-width', (image.naturalWidth * 4) + 'px'); } };
  if (image.complete) { constrain(); } else { image.addEventListener('load', constrain, { once: true }); }
});
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
   link.dataset.kind = entry.kind;
   if (entry.git?.kind === 'ignored') { link.dataset.gitIgnored = 'true'; }
  if (entry.queryRemove) { link.dataset.queryRemove = entry.queryRemove.join(' '); }
   link.textContent = entry.name + (entry.directory ? '/' : '');
   if (entry.accessDenied) { link.ariaLabel = entry.name + ' directory, access denied'; const lock = document.createElement('span'); lock.className = 'tree-access-denied'; lock.title = 'Access denied'; lock.ariaHidden = 'true'; lock.textContent = ' 🔒'; link.append(lock); }
   const marker = entry.git ? document.createElement('span') : null;
   if (marker) { marker.className = 'git-marker'; marker.dataset.gitKind = entry.git.kind; marker.title = marker.ariaLabel = entry.git.tooltip; marker.textContent = entry.git.display; }
  if (!entry.directory) {
    if (entry.filesHref) {
      item.className = 'tree-entry-row';
      const files = filesLink(entry.filesHref, entry.filesLabel ?? entry.name);
      syncNavigationLinks([link, files]);
       item.append(link, ...(marker ? [marker] : []), files);
    } else {
      syncNavigationLinks([link]);
       item.append(link, ...(marker ? [marker] : []));
    }
    list.append(item);
    return;
  }
  const details = document.createElement('details');
  details.dataset.path = entry.path;
  const summary = document.createElement('summary');
   summary.append(link, ...(marker ? [marker] : []));
  details.append(summary, document.createElement('ul'));
  const files = filesLink(entry.filesHref, entry.name);
  summary.append(files);
  syncNavigationLinks([link, files]);
  item.append(details); list.append(item);
});
tree?.addEventListener('toggle', async (event) => {
  const details = event.target;
  if (!(details instanceof HTMLDetailsElement) || !details.matches('[data-path]') ||
    !details.open || details.dataset.loaded === 'true' || details.dataset.loading === 'true') { return; }
  details.dataset.loading = 'true';
  try {
    const response = await fetch('/__markdown_serve__/tree?path=' +
      encodeURIComponent(details.dataset.path));
    if (!response.ok || details.dataset.loaded === 'true') { return; }
    addEntries(details.querySelector('ul'), await response.json());
    details.dataset.loaded = 'true';
  } finally { delete details.dataset.loading; }
}, true);`;
