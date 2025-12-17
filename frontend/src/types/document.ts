export interface DocumentMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface DocumentIndex {
  documents: DocumentMeta[];
  activeId: string;
}

export interface SearchResult {
  id: string;
  title: string;
  snippet: string;
}

export interface Settings {
  theme: 'light' | 'dark';
}
