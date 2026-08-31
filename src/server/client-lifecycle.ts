/** Keeps page-specific behavior alive when Turbo replaces the body. */
export const clientLifecycle = `
const pageInitializers = [];
let activePageBody;
let pageController;
let pageSignal;
let cleanupPage = () => {};
const registerPageInitializer = (initializer) => pageInitializers.push(initializer);
globalThis.markdownServeRegisterPageInitializer = registerPageInitializer;
const initializePage = () => {
  const body = document.body;
  if (!body || body === activePageBody) return;
  cleanupPage();
  activePageBody = body;
  if (document.documentElement?.dataset) {
    document.documentElement.dataset.directoryView = body.dataset.directoryView ?? 'false';
  }
  pageController = new AbortController();
  pageSignal = pageController.signal;
  const cleanups = pageInitializers.map((initializer) => initializer(body)).filter((cleanup) => typeof cleanup === 'function');
  cleanupPage = () => { pageController?.abort(); cleanups.splice(0).reverse().forEach((cleanup) => cleanup()); };
};
document.addEventListener('DOMContentLoaded', initializePage);
document.addEventListener('turbo:load', initializePage);
document.addEventListener('turbo:before-cache', () => { cleanupPage(); activePageBody = undefined; });`;
