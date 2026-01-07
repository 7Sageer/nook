// Package rag provides Retrieval Augmented Generation (RAG) functionality
// for semantic search and document indexing.
package rag

// DocumentIndexer handles document content indexing.
// Implementations: *Indexer
type DocumentIndexer interface {
	// IndexDocument indexes a single document by ID
	IndexDocument(docID string) error

	// ForceReindexDocument rebuilds a document's index from scratch
	ForceReindexDocument(docID string) error

	// ReindexAll rebuilds all document indexes
	ReindexAll() (int, error)

	// ReindexAllWithCallback rebuilds all with progress callback
	ReindexAllWithCallback(onProgress func(current, total int)) (int, error)
}

// ChunkSearcher performs semantic search over indexed content.
// Implementations: *Searcher
type ChunkSearcher interface {
	// SearchDocuments performs document-level search with chunk aggregation
	SearchDocuments(query string, limit int, filter *SearchFilter) ([]DocumentSearchResult, error)

	// SearchChunks performs block-level search without aggregation
	SearchChunks(query string, limit int, filter *SearchFilter) ([]ChunkMatch, error)
}

// ExternalContentIndexer handles indexing of external content (bookmarks, files, folders).
// Implementations: *ExternalIndexer
type ExternalContentIndexer interface {
	// IndexBookmarkContent indexes web page content from a bookmark URL
	IndexBookmarkContent(url, sourceDocID, blockID string) error

	// IndexFileContent indexes file content (PDF, DOCX, etc.)
	// fileName is the original file name for display (optional, falls back to path basename)
	IndexFileContent(filePath, sourceDocID, blockID, fileName string) error

	// IndexFolderContent indexes all supported files in a folder
	IndexFolderContent(folderPath, sourceDocID, blockID string, maxDepth int) (*FolderIndexResult, error)

	// ReindexAll reindexes all bookmark and file blocks
	ReindexAll() (int, error)

	// ReindexAllWithProgress reindexes all with progress callback
	ReindexAllWithProgress(onProgress func(current, total int)) (int, error)
}

// EmbeddingProvider generates vector embeddings for text.
// Implementations: EmbeddingClient (ollama/openai)
type EmbeddingProvider interface {
	// Embed generates a vector embedding for the given text
	Embed(text string) ([]float32, error)

	// GetDimension returns the embedding dimension
	GetDimension() int
}

// VectorStorage provides vector storage and search operations.
// Implementations: *VectorStore
type VectorStorage interface {
	// Insert adds a block vector with embedding
	Insert(bv *BlockVector) error

	// Search finds similar vectors
	Search(queryVec []float32, limit int, filter *SearchFilter) ([]SearchResult, error)

	// DeleteByDocID removes all vectors for a document
	DeleteByDocID(docID string) error

	// DeleteByBlockID removes a specific block's vectors
	DeleteByBlockID(blockID string) error
}

// ContentExtractor extracts text content from various sources.
type ContentExtractor interface {
	// ExtractFromFile extracts text from a file path
	ExtractFromFile(filePath string) (string, error)

	// ExtractFromURL extracts text from a web page
	ExtractFromURL(url string) (string, error)

	// SupportedExtensions returns list of supported file extensions
	SupportedExtensions() []string
}
