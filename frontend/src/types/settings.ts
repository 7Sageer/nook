/**
 * Embedding model configuration for RAG system
 */
export interface EmbeddingConfig {
    provider: string;
    baseUrl: string;
    model: string;
    apiKey: string;
    maxChunkSize: number;
    overlap: number;
}

/**
 * RAG system status information
 */
export interface RAGStatus {
    enabled: boolean;
    indexedDocs: number;
    indexedBookmarks: number;
    indexedFiles: number;
    totalDocs: number;
    lastIndexTime: string;
}

/**
 * MCP server information
 */
export interface MCPInfo {
    binaryPath: string;
    configJson: string;
}
