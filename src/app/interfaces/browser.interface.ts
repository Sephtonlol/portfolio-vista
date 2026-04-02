export interface SearchResponse {
  success: boolean;
  query: string;
  durationMs: number;
  resultCount: number;
  results?: Result[];
}

export interface Result {
  title: string;
  link: string;
  snippet: string;
  site: string;
  favicon: string | null;
}

export interface ImagesResponse {
  success: boolean;
  query: string;
  durationMs: number;
  resultCount: number;
  results?: ImageResult[];
}

export interface ImageResult {
  title: string;
  image: string;
  thumbnail: string;
  source: string;
}

export type BrowserView = 'sites' | 'images';

export interface Tab {
  id: number;
  query: string;
  view: BrowserView;
  results: Result[];
  imageResults: ImageResult[];
  lastSitesQuery: string;
  lastImagesQuery: string;
  lastSitesDurationMs: number | null;
  lastImagesDurationMs: number | null;
  lastSitesResultCount: number | null;
  lastImagesResultCount: number | null;
  isLoadingSites: boolean;
  isLoadingImages: boolean;
}
