export const displayInitialClient = `
const displayState = new URLSearchParams(location.search);
const displayTheme = ['auto', 'light', 'dark'].includes(displayState.get('theme')) ? displayState.get('theme') : 'auto';
const displayWidth = ['auto', 'wide'].includes(displayState.get('width')) ? displayState.get('width') : 'auto';
document.documentElement.dataset.colorMode = displayTheme;
document.documentElement.dataset.width = displayWidth;`;

export const displayControlsClient = `
const displayControls = document.querySelector('.display-controls');
const setDisplay = (theme, width) => {
  document.documentElement.dataset.colorMode = theme;
  document.documentElement.dataset.width = width;
  displayControls.elements.theme.value = theme;
  displayControls.elements.width.value = width;
};
const readDisplay = () => {
  const state = new URLSearchParams(location.search);
  return {
    theme: ['auto', 'light', 'dark'].includes(state.get('theme')) ? state.get('theme') : 'auto',
    width: ['auto', 'wide'].includes(state.get('width')) ? state.get('width') : 'auto',
  };
};
const writeDisplay = (theme, width) => {
  const url = new URL(location.href);
  url.searchParams.set('theme', theme);
  url.searchParams.set('width', width);
  history.replaceState(null, '', url);
  setDisplay(theme, width);
};
const initialDisplay = readDisplay();
setDisplay(initialDisplay.theme, initialDisplay.width);
displayControls?.addEventListener('change', () => {
  writeDisplay(displayControls.elements.theme.value, displayControls.elements.width.value);
});
addEventListener('popstate', () => {
  const { theme, width } = readDisplay();
  setDisplay(theme, width);
});
addEventListener('keydown', (event) => {
  if (event.key !== 'w' || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.defaultPrevented ||
    event.target instanceof Element && event.target.closest('a, button, input, select, textarea, [contenteditable]')) { return; }
  const { theme, width } = readDisplay();
  writeDisplay(theme, width === 'wide' ? 'auto' : 'wide');
});`;
