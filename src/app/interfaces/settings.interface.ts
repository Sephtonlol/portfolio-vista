export interface AppSettings {
  theme: 'light' | 'dark';
  animations: boolean;
  backgroundImage: string | ArrayBuffer | null;
  backgroundFit: 'cover' | 'contain' | 'stretch' | 'repeat';
}
