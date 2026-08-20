export type ReloadSource = {
  subscribe(
    listener: () => void | Promise<void>,
    onClose?: () => void,
  ): () => void;
};
