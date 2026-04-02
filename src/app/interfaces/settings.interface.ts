export type ColorMode = 'dark' | 'light';

export type AccentTheme = 'default' | 'red' | 'green' | 'blue' | 'pink';

export interface AppSettings {
  colorMode: ColorMode;
  accent: AccentTheme;
  animations: boolean;
  backgroundImage: string | ArrayBuffer | null;
  backgroundFit: 'cover' | 'contain' | 'stretch' | 'repeat';
}
