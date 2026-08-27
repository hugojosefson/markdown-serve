export const fileSearchClient = `
const goToFileScope = document.body?.dataset.goToFileScope;
if (goToFileScope !== undefined) {
  let goToFile;
  const openGoToFile = () => {
    if (!goToFile) {
      const dialog = document.createElement('dialog');
      dialog.className = 'go-to-file';
      dialog.innerHTML = '<form method="dialog"><label>Go to file<input type="search" autocomplete="off" placeholder="Filter files"></label><p class="go-to-file-status" aria-live="polite"></p><ul></ul></form>';
      document.body.append(dialog);
      const input = dialog.querySelector('input');
      const list = dialog.querySelector('ul');
      const status = dialog.querySelector('.go-to-file-status');
      let files = []; let selected = 0; let loading = false; let failed = false; let controller;
      const render = () => {
        const filter = input.value.toLocaleLowerCase();
        const matches = files.filter((file) => file.name.toLocaleLowerCase().includes(filter)).slice(0, 100);
        selected = Math.min(selected, Math.max(0, matches.length - 1));
        list.replaceChildren(...matches.map((file, index) => {
          const item = document.createElement('li'); const link = document.createElement('a');
          link.href = file.href; link.textContent = file.name; link.tabIndex = -1;
          if (index === selected) { item.dataset.selected = 'true'; }
          item.append(link); return item;
        }));
        status.textContent = loading ? 'Loading files…' : failed ? 'File search unavailable' : files.length ? matches.length + ' of ' + files.length + ' files' : 'No files found';
        list.querySelector?.('[data-selected="true"]')?.scrollIntoView?.({ block: 'nearest' });
        return matches;
      };
      const load = async () => {
        controller?.abort(); const current = controller = new AbortController(); loading = true; failed = false; files = []; render();
        try {
          const response = await fetch('/__markdown_serve__/files?path=' + encodeURIComponent(goToFileScope), { signal: current.signal });
          if (!response.ok) throw new Error('File search unavailable');
          const loaded = await response.json(); if (controller === current) files = loaded;
        } catch (error) { if (controller === current && error?.name !== 'AbortError') { failed = true; } }
        finally { if (controller === current) { loading = false; render(); } }
      };
      input.addEventListener('input', () => { selected = 0; render(); });
      dialog.addEventListener('keydown', (event) => {
        const matches = render();
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); selected = (selected + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % Math.max(1, matches.length); render(); }
        if (event.key === 'Enter') { event.preventDefault(); if (matches.length) location.assign(matches[selected].href); }
        if (event.key === 'Escape') { dialog.close(); }
      });
      dialog.addEventListener('close', () => controller?.abort());
      goToFile = { dialog, input, load };
    }
    goToFile.dialog.showModal(); goToFile.input.value = ''; goToFile.input.focus(); goToFile.load();
  };
  document.addEventListener('keydown', (event) => {
    const target = event.target;
    if (event.key !== 'g' || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || target?.matches?.('input, textarea, select, [contenteditable="true"]')) return;
    event.preventDefault(); openGoToFile();
  });
}`;
