export type ReloadSource = {
  subscribe(
    listener: () => void | Promise<void>,
    onClose?: () => void,
  ): () => void;
  /** Retains a rendered file while an SSE client is viewing it. */
  trackViewedFile?(path: string, renderedRevision: string): () => void;
};
