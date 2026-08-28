export const reloadClientScript = `
let reloadEvents;
let reloadConnected = false;
const disconnectReload = () => reloadEvents?.close();
const reloadPage = () => {
  if (document.querySelector?.('.edit-page')) {
    document.dispatchEvent?.(new Event('markdown-serve:reload'));
    return;
  }
  disconnectReload(); location.reload();
};
const connectReload = () => {
  reloadConnected = false;
  reloadEvents = new EventSource('/__markdown_serve__/events');
  reloadEvents.addEventListener('open', () => {
    if (reloadConnected) { reloadPage(); return; }
    reloadConnected = true;
  });
  reloadEvents.addEventListener('reload', reloadPage);
};
connectReload();
document.addEventListener('click', (event) => {
  const link = event.target?.closest?.('a[href]');
  if (!link || event.defaultPrevented || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
    link.matches('.download-link, [download]') || (link.target && link.target !== '_self')) { return; }
  const current = new URL(location.href);
  const target = new URL(link.href, current);
  if (target.origin === current.origin && target.pathname === current.pathname && target.search === current.search && target.hash !== current.hash) { return; }
  disconnectReload();
});
globalThis.navigation?.addEventListener('navigate', (event) => {
  if (!event.hashChange && !event.downloadRequest) { disconnectReload(); }
});
globalThis.addEventListener('pagehide', disconnectReload);
globalThis.addEventListener('pageshow', (event) => {
  if (event.persisted) { connectReload(); }
});`;
