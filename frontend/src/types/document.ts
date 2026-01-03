import { document, handlers } from "../../wailsjs/go/models";

export type DocumentMeta = document.Meta;
export type DocumentIndex = document.Index;

export type SearchResult = handlers.SearchResult;
export type ChunkMatch = handlers.ChunkMatch;
export type DocumentSearchResult = handlers.DocumentSearchResult;
export type TagInfo = handlers.TagInfo;

// Keep strict union type for frontend usage if needed, or alias it
export interface Settings extends Omit<handlers.Settings, 'theme'> {
  theme: 'light' | 'dark' | 'system';
}
