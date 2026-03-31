export interface SearchResponse {
  success: boolean;
  query: string;
  results?: Result[];
}

export interface Result {
  title: string;
  link: string;
  snippet: string;
  site: string;
  favicon: string | null;
}

export interface Tab {
  id: number;
  query: string;
  results: Result[];
}
