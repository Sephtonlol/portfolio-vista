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
  type: 'directory' | 'text' | 'image' | 'audio' | 'video';
}
