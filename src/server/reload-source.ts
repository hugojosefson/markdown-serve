export type ReloadSource = {
  subscribe(listener: () => void, onClose?: () => void): () => void;
};
