export function installDialogDismissal<Event extends { target: unknown }>(
  dialog: {
    addEventListener(type: string, listener: (event: Event) => void): void;
    close(): void;
  },
  cleanup: () => void,
): void {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog as unknown) dialog.close();
  });
  dialog.addEventListener("close", cleanup);
}

export const dialogDismissalClient = `${installDialogDismissal.toString()}`;
