export const codeToolbarClient = `
const codeToolbarListenerOptions = typeof pageSignal === 'undefined' ? {} : { signal: pageSignal };
document.addEventListener('click', async (event) => {
  if (!(event.target instanceof Element)) { return; }
  const button = event.target.closest('[data-copy]');
  if (!(button instanceof HTMLButtonElement)) { return; }
  const block = button.closest('.code-block');
  const code = block?.querySelector('code, pre');
  const status = block?.querySelector('.code-copy-status');
  const reset = () => {
    button.textContent = 'Copy';
    if (status) { status.textContent = ''; }
  };
  try {
    await navigator.clipboard.writeText(code?.textContent ?? '');
    button.textContent = 'Copied';
    if (status) { status.textContent = 'Copied'; }
  } catch {
    button.textContent = 'Copy failed';
    if (status) { status.textContent = 'Copy failed'; }
  }
  setTimeout(reset, 1500);
}, codeToolbarListenerOptions);`;
