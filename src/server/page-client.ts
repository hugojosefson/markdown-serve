export const pageClient = `
const browse = document.querySelector('.browse');
const tree = document.querySelector('.tree');
browse?.addEventListener('click', () => {
  const open = tree.dataset.open !== 'true';
  tree.dataset.open = String(open);
  browse.setAttribute('aria-expanded', String(open));
});
const addEntries = (list, entries) => entries.forEach((entry) => {
  const item = document.createElement('li');
  const link = document.createElement('a');
  link.href = entry.href;
  link.textContent = entry.name + (entry.directory ? '/' : '');
  if (!entry.directory) { item.append(link); list.append(item); return; }
  const details = document.createElement('details');
  details.dataset.path = entry.path;
  const summary = document.createElement('summary');
  summary.append(link);
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
