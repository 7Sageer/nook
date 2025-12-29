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

export interface SemanticSearchResult {
  docId: string;
  docTitle: string;
  blockId: string;
  content: string;
  blockType: string;
  score: number;
}

export interface ChunkMatch {
  blockId: string;
  content: string;
  blockType: string;
  headingContext: string;
  score: number;
}

export interface DocumentSearchResult {
  docId: string;
  docTitle: string;
  maxScore: number;
  matchedChunks: ChunkMatch[];
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
