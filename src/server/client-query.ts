// Browser source intentionally mirrors query.ts; it is tested against shared fixtures.
export const navigationQueryClient = `
const navigationHrefs = new WeakMap();
const queryPairs = (search) => search.replace(/^\\?/, '').split('&').filter(Boolean).map((part, index) => {
  const equals = part.indexOf('=');
  const decode = (value) => { try { return decodeURIComponent(value.replaceAll('+', ' ')); } catch { return value; } };
  return { key: decode(equals < 0 ? part : part.slice(0, equals)), value: equals < 0 ? undefined : decode(part.slice(equals + 1)), index };
});
const canonicalNavigationQuery = (pairs) => {
  const lexical = (left, right) => left < right ? -1 : left > right ? 1 : 0;
  return pairs.sort((a, b) => lexical(a.key, b.key) || lexical(a.value ?? '', b.value ?? '') || a.index - b.index).map(({ key, value }) => encodeURIComponent(key) + (value === undefined ? '' : '=' + encodeURIComponent(value))).join('&');
};
const syncNavigationLinks = (links = document.querySelectorAll('a')) => {
  links.forEach((link) => {
    const href = navigationHrefs.get(link) ?? link.getAttribute('href');
    if (href === null || link.matches('.display-link, .raw-link, .download-link, .file-metadata') || href.startsWith('#')) { return; }
    let url;
    try { url = new URL(href, location.href); } catch { return; }
    if (url.origin !== location.origin) { return; }
    navigationHrefs.set(link, href);
    const removed = new Set((link.getAttribute('data-query-remove') ?? '').split(/\\s+/).filter(Boolean));
    const target = queryPairs(url.search).filter(({ key }) => !removed.has(key));
    const targetKeys = new Set(target.map(({ key }) => key));
    const pairs = queryPairs(location.search).filter(({ key }) => !targetKeys.has(key) && !removed.has(key)).concat(target);
    const query = canonicalNavigationQuery(pairs);
    const hash = href.includes('#') ? '#' + href.split('#').slice(1).join('#') : '';
    const path = href.split(/[?#]/, 1)[0];
    link.setAttribute('href', path + (query ? '?' + query : '') + hash);
  });
};`;
