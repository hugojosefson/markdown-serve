export const viewTransitionClient = `
addEventListener('pageswap', (event) => {
  const transition = event.viewTransition;
  const from = event.activation?.from?.url;
  const to = event.activation?.entry?.url;
  if (!transition || !from || !to) { return; }
  const current = new URL(from);
  const target = new URL(to);
  if (current.pathname !== target.pathname) { return; }
  const withoutFlag = (url, flag) => {
    const copy = new URL(url);
    copy.searchParams.delete(flag);
    const entries = [...copy.searchParams].sort(([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0);
    copy.search = new URLSearchParams(entries).toString();
    return copy.href;
  };
  const onlyFlagChanged = (flag) => {
    return current.searchParams.has(flag) !== target.searchParams.has(flag) && withoutFlag(current, flag) === withoutFlag(target, flag);
  };
  const view = (url) => url.searchParams.has('edit') ? 'edit' : url.searchParams.has('source') ? 'source' : 'rendered';
  const withoutView = (url) => withoutFlag(new URL(withoutFlag(url, 'source')), 'edit');
  const onlyViewChanged = view(current) !== view(target) && withoutView(current) === withoutView(target);
  if (!onlyFlagChanged('metadata') && !onlyViewChanged) { transition.skipTransition(); }
});`;
