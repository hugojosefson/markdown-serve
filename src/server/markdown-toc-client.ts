export const markdownTocClient = `
const markdownTocFragment = (value) => {
  if (!value) { return ''; }
  const fragment = value.startsWith('#') ? value.slice(1) : new URL(value, location.href).hash.slice(1);
  try { return decodeURIComponent(fragment); } catch { return fragment; }
};
const syncMarkdownTocLocation = () => {
  const toc = document.querySelector('.markdown-toc');
  if (!toc) { return; }
  const id = markdownTocFragment(location.hash);
  toc.querySelectorAll('a[href]').forEach((link) => {
    const current = markdownTocFragment(link.getAttribute('href') ?? '') === id;
    link.classList.toggle('is-current', current);
    if (current) { link.setAttribute('aria-current', 'location'); }
    else { link.removeAttribute('aria-current'); }
  });
};
syncMarkdownTocLocation();
addEventListener('hashchange', syncMarkdownTocLocation);`;
