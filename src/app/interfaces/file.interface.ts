export interface FileNode {
  name: string; // filename or folder name
  type: 'directory' | 'txt' | 'mp4' | 'mp3' | 'png'; // distinguish files vs. folders
  content?: string; // for small text‐based files
  children?: FileNode[]; // only on type==='directory'
}
