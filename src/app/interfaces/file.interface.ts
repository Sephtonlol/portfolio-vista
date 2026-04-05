export type FileNodeType =
  | 'directory'
  | 'md'
  | 'mp4'
  | 'mp3'
  | 'png'
  | 'shortcut'
  | 'url';

// Note: this interface is used by both:
// - the current client-side JSON tree model (children/path)
// - the backend flat model (parentId/_id/createdAt/updatedAt)
export interface FileNode {
  // Backend fields
  _id?: string;
  name: string;
  type: FileNodeType;
  parentId?: string | null;

  content?: string;
  url?: string;
  shortcutTo?: string;

  createdAt?: string;
  updatedAt?: string;

  // UI-only helpers (tree model)
  children?: FileNode[];
  path?: string;
}
