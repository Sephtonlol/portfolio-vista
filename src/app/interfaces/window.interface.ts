export interface Window {
  id?: string;
  application: string;
  icon: string;
  data?: Data;
  opened?: boolean;
  minimized?: boolean;
  focused?: boolean;

  // UI-only layout persistence (used to restore window bounds after sleep/unlock)
  layout?: WindowLayout;
}

export type WindowLayoutMode =
  | 'normal'
  | 'maximized'
  | 'snap-left'
  | 'snap-right';

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowLayout {
  mode: WindowLayoutMode;
  bounds: WindowBounds;
  normalBounds: WindowBounds;
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
