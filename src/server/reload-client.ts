export const reloadClient = `
let reloadEvents;
let reloadConnected = false;
let reloadGeneration = 0;
const disconnectReload = () => {
  reloadGeneration++;
  reloadEvents?.close();
  reloadEvents = undefined;
  reloadConnected = false;
};
const reloadPage = () => {
  if (document.querySelector?.('.edit-page')) {
    document.dispatchEvent?.(new Event('markdown-serve:reload'));
    return;
  }
  disconnectReload(); location.reload();
};
const connectReload = () => {
  if (globalThis.markdownServeRegisterPageInitializer && !document.body?.dataset?.reloadEnabled) return;
  const generation = ++reloadGeneration;
  reloadConnected = false;
  const reloadPath = document.body?.dataset?.reloadPath;
  const reloadRevision = document.body?.dataset?.reloadRevision;
  const reloadUrl = reloadPath && reloadRevision
    ? '/__markdown_serve__/events?path=' + encodeURIComponent(reloadPath) + '&revision=' + encodeURIComponent(reloadRevision)
    : '/__markdown_serve__/events';
  const events = new EventSource(reloadUrl);
  reloadEvents = events;
  events.addEventListener('open', () => {
    if (generation !== reloadGeneration || reloadEvents !== events) { return; }
    if (reloadConnected) { reloadPage(); return; }
    reloadConnected = true;
  });
  events.addEventListener('reload', () => {
    if (generation === reloadGeneration && reloadEvents === events) { reloadPage(); }
  });
};
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
});
const registerReloadPageInitializer = globalThis.markdownServeRegisterPageInitializer ?? ((initializer) => initializer());
registerReloadPageInitializer(() => { connectReload(); return disconnectReload; });`;

/** Compatibility export for tests and consumers of the former inline script. */
export const reloadClientScript = reloadClient;
