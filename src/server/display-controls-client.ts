export const displayInitialClient = `
const displayState = new URLSearchParams(location.search);
const displayTheme = ['auto', 'light', 'dark'].includes(displayState.get('theme')) ? displayState.get('theme') : 'auto';
const displayWidth = ['narrow', 'wide'].includes(displayState.get('width')) ? displayState.get('width') : 'narrow';
document.documentElement.dataset.colorMode = displayTheme;
document.documentElement.dataset.width = displayWidth;`;

import { navigationQueryClient } from "./client-query.ts";

export const displayControlsClient = `${navigationQueryClient}
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
