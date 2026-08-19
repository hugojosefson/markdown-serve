export const displayInitialClient = `
const displayState = new URLSearchParams(location.search);
const displayTheme = ['auto', 'light', 'dark'].includes(displayState.get('theme')) ? displayState.get('theme') : 'auto';
const displayWidth = ['narrow', 'wide'].includes(displayState.get('width')) ? displayState.get('width') : 'narrow';
document.documentElement.dataset.colorMode = displayTheme;
document.documentElement.dataset.width = displayWidth;`;

export const displayControlsClient = `
const displayHrefs = new WeakMap();
const validDisplay = (value, values) => values.includes(value) ? value : undefined;
const displayParams = () => {
  const state = new URLSearchParams(location.search);
  const theme = validDisplay(state.get('theme'), ['auto', 'light', 'dark']);
  const width = validDisplay(state.get('width'), ['narrow', 'wide']);
  return {
    theme: theme === 'auto' ? undefined : theme,
    width: width === 'narrow' ? undefined : width,
  };
};
const syncDisplayLinks = (links = document.querySelectorAll('a')) => {
  const { theme, width } = displayParams();
  links.forEach((link) => {
    const href = displayHrefs.get(link) ?? link.getAttribute('href');
    if (href === null || link.matches('.display-link') || href.startsWith('#')) { return; }
    displayHrefs.set(link, href);
    const url = new URL(href, location.href);
    if (url.origin !== location.origin) { return; }
    const pairs = url.search.slice(1).split('&').filter(Boolean).map((part, index) => {
      const equals = part.indexOf('=');
      const decode = (value) => { try { return decodeURIComponent(value.replaceAll('+', ' ')); } catch { return value; } };
      return { key: decode(equals < 0 ? part : part.slice(0, equals)), value: equals < 0 ? undefined : decode(part.slice(equals + 1)), index };
    });
    const set = (key, value) => {
      const index = pairs.length;
      for (let at = pairs.length - 1; at >= 0; at--) { if (pairs[at].key === key) { pairs.splice(at, 1); } }
      if (value) { pairs.push({ key, value, index }); }
    };
    set('theme', theme);
    set('width', width);
    const lexical = (left, right) => left < right ? -1 : left > right ? 1 : 0;
    pairs.sort((a, b) => lexical(a.key, b.key) || lexical(a.value ?? '', b.value ?? '') || a.index - b.index);
    url.search = pairs.map(({ key, value }) => encodeURIComponent(key) + (value === undefined ? '' : '=' + encodeURIComponent(value))).join('&');
    const query = url.search + url.hash;
    const path = href.split(/[?#]/, 1)[0];
    link.setAttribute('href', path + query);
  });
};
const setDisplay = (theme, width) => {
  document.documentElement.dataset.colorMode = theme;
  document.documentElement.dataset.width = width;
  syncDisplayLinks();
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
