export interface FileNode {
  name: string;
  type: 'directory' | 'md' | 'mp4' | 'mp3' | 'png';
  content?: string;
  children?: FileNode[];
}
