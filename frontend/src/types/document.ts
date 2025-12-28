export interface DocumentMeta {
  id: string;
  title: string;
  tags?: string[];
  order: number;
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
  theme: 'light' | 'dark' | 'system';
}

export interface TagInfo {
  name: string;
  count: number;
  color?: string;
  isGroup?: boolean;
  collapsed?: boolean;
  order?: number;
}
