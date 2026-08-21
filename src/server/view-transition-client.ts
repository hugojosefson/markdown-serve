export const viewTransitionClient = `
addEventListener('pageswap', (event) => {
  const transition = event.viewTransition;
  const from = event.activation?.from?.url;
  const to = event.activation?.entry?.url;
  if (!transition || !from || !to) { return; }
  const current = new URL(from);
  const target = new URL(to);
  if (current.pathname !== target.pathname) { return; }
  const currentWithoutMetadata = new URL(current);
  const targetWithoutMetadata = new URL(target);
  currentWithoutMetadata.searchParams.delete('metadata');
  targetWithoutMetadata.searchParams.delete('metadata');
  const metadataChanged = JSON.stringify(current.searchParams.getAll('metadata')) !== JSON.stringify(target.searchParams.getAll('metadata'));
  if (!metadataChanged || currentWithoutMetadata.href !== targetWithoutMetadata.href) { transition.skipTransition(); }
});`;
