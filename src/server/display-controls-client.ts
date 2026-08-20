export const displayInitialClient = `
const displayState = new URLSearchParams(location.search);
const displayTheme = ['auto', 'light', 'dark'].includes(displayState.get('theme')) ? displayState.get('theme') : 'auto';
const displayWidth = ['narrow', 'wide'].includes(displayState.get('width')) ? displayState.get('width') : 'narrow';
document.documentElement.dataset.colorMode = displayTheme;
document.documentElement.dataset.width = displayWidth;`;

export const displayControlsClient = `
const navigationHrefs = new WeakMap();
const queryPairs = (search) => search.replace(/^\\?/, '').split('&').filter(Boolean).map((part, index) => {
  const equals = part.indexOf('=');
  const decode = (value) => { try { return decodeURIComponent(value.replaceAll('+', ' ')); } catch { return value; } };
  return { key: decode(equals < 0 ? part : part.slice(0, equals)), value: equals < 0 ? undefined : decode(part.slice(equals + 1)), index };
});
const syncNavigationLinks = (links = document.querySelectorAll('a')) => {
  links.forEach((link) => {
    const href = navigationHrefs.get(link) ?? link.getAttribute('href');
    if (href === null || link.matches('.display-link, .raw-link') || href.startsWith('#')) { return; }
    let url;
    try { url = new URL(href, location.href); } catch { return; }
    if (url.origin !== location.origin) { return; }
    navigationHrefs.set(link, href);
    const target = queryPairs(url.search);
    const targetKeys = new Set(target.map(({ key }) => key));
    const pairs = queryPairs(location.search).filter(({ key }) => !targetKeys.has(key)).concat(target);
    const lexical = (left, right) => left < right ? -1 : left > right ? 1 : 0;
    pairs.sort((a, b) => lexical(a.key, b.key) || lexical(a.value ?? '', b.value ?? '') || a.index - b.index);
    const query = pairs.length ? '?' + pairs.map(({ key, value }) => encodeURIComponent(key) + (value === undefined ? '' : '=' + encodeURIComponent(value))).join('&') : '';
    const hash = href.includes('#') ? '#' + href.split('#').slice(1).join('#') : '';
    const path = href.split(/[?#]/, 1)[0];
    link.setAttribute('href', path + query + hash);
  });
};
const setDisplay = (theme, width) => {
  document.documentElement.dataset.colorMode = theme;
  document.documentElement.dataset.width = width;
  syncNavigationLinks();
};
const readDisplay = () => {
  const state = new URLSearchParams(location.search);
  return {
    theme: ['auto', 'light', 'dark'].includes(state.get('theme')) ? state.get('theme') : 'auto',
    width: ['narrow', 'wide'].includes(state.get('width')) ? state.get('width') : 'narrow',
  };
};
const initialDisplay = readDisplay();
setDisplay(initialDisplay.theme, initialDisplay.width);
addEventListener('popstate', () => {
  const { theme, width } = readDisplay();
  setDisplay(theme, width);
});
addEventListener('keydown', (event) => {
  if (!['t', 'w'].includes(event.key) || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.defaultPrevented ||
    event.target?.closest?.('a, button, input, select, textarea, [contenteditable]')) { return; }
  const group = document.querySelector(event.key === 't' ? '.display-theme' : '.display-width');
  const selected = group?.querySelector?.('[aria-current="true"]');
  (selected?.nextElementSibling ?? group?.querySelector?.('a'))?.click();
});`;
