export const reloadClientScript = `
const reloadEvents = new EventSource('/__markdown_server__/events');
let reloadConnected = false;
reloadEvents.addEventListener('open', () => {
  if (reloadConnected) { location.reload(); return; }
  reloadConnected = true;
});
reloadEvents.addEventListener('reload', () => location.reload());`;
