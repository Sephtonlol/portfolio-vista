export interface Window {
  id?: string;
  application: string;
  icon: string;
  data?: Data;
  opened?: boolean;
  minimized?: boolean;
  focused?: boolean;
}

export interface Data {
  title: string;
  content: string;
  type: 'directory' | 'text' | 'image' | 'media';

  // Optional backend helpers
  folderId?: string | null;
  parentId?: string | null;
  itemId?: string;
  selectedId?: string;
  url?: string;
}
