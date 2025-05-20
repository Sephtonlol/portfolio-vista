export interface FileNode {
  name: string;
  type: 'directory' | 'md' | 'mp4' | 'mp3' | 'png' | "shortcut" | "url";
  content?: string;
  children?: FileNode[];
  path?: string;
}
