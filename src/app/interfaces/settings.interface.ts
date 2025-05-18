export interface AppSettings {
  theme: string;
  animations: boolean;
  backgroundImage: string | ArrayBuffer | null;
  backgroundFit: 'cover' | 'contain' | 'stretch' | 'repeat';
}
