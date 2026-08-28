export const fileSearchClient = `
const goToFilePrefix = document.body?.dataset.goToFilePrefix;
if (goToFilePrefix !== undefined) {
  let goToFile;
  const openGoToFile = () => {
    if (!goToFile) {
      const dialog = document.createElement('dialog'); dialog.className = 'go-to-file';
      dialog.innerHTML = '<form method="dialog"><label>Go to file<input type="search" autocomplete="off" placeholder="Find files and directories"></label><p class="go-to-file-status" aria-live="polite"></p><ul></ul></form>';
      document.body.append(dialog);
      const input = dialog.querySelector('input'); const list = dialog.querySelector('ul'); const status = dialog.querySelector('.go-to-file-status');
      let files = []; let selected = 0; let loading = false; let failed = false; let controller; let timer;
      const render = () => {
        selected = Math.min(selected, Math.max(0, files.length - 1));
        list.replaceChildren(...files.map((file, index) => {
          const item = document.createElement('li'); const link = document.createElement('a'); link.href = file.href; link.textContent = file.path; link.tabIndex = -1;
          if (index === selected) item.dataset.selected = 'true'; item.append(link); return item;
        }));
        status.textContent = loading ? 'Loading entries…' : failed ? 'File search unavailable' : files.length ? files.length + ' entries' : 'No entries found';
        list.querySelector?.('[data-selected="true"]')?.scrollIntoView?.({ block: 'nearest' });
      };
      const load = async () => {
        controller?.abort(); const current = controller = new AbortController(); const query = input.value; loading = true; failed = false; files = []; render();
        try { const response = await fetch('/__markdown_serve__/files?search=' + encodeURIComponent(query), { signal: current.signal }); if (!response.ok) throw new Error('File search unavailable'); const loaded = await response.json(); if (controller === current && input.value === query) files = loaded; }
        catch (error) { if (controller === current && error?.name !== 'AbortError') failed = true; }
        finally { if (controller === current) { loading = false; render(); } }
      };
      const schedule = () => { clearTimeout(timer); controller?.abort(); timer = setTimeout(load, 180); };
      input.addEventListener('input', () => { selected = 0; schedule(); });
      dialog.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); selected = (selected + (event.key === 'ArrowDown' ? 1 : -1) + files.length) % Math.max(1, files.length); render(); }
        if (event.key === 'Enter' && files.length) { event.preventDefault(); location.assign(files[selected].href); }
      });
      installDialogDismissal(dialog, () => { clearTimeout(timer); controller?.abort(); });
      goToFile = { dialog, input, load };
    }
    if (!goToFile.dialog.open) goToFile.dialog.showModal(); goToFile.input.value = goToFilePrefix; goToFile.input.focus(); goToFile.load();
  };
  document.addEventListener('keydown', (event) => {
    const target = event.target;
    if (event.key !== 'g' || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || target?.closest?.('a, input, textarea, select, button, [contenteditable]')) return;
    event.preventDefault(); openGoToFile();
  });
}`;
