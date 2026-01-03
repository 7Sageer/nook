package utils

import (
	"path/filepath"
)

// PathBuilder helps construct filesystem paths for the application
type PathBuilder struct {
	dataPath string
}

// NewPathBuilder creates a new PathBuilder instance
func NewPathBuilder(dataPath string) *PathBuilder {
	return &PathBuilder{
		dataPath: dataPath,
	}
}

// DataPath returns the root data path
func (p *PathBuilder) DataPath() string {
	return p.dataPath
}

// Index returns the path to the document index file
func (p *PathBuilder) Index() string {
	return filepath.Join(p.dataPath, "index.json")
}

// Folders returns the path to the folder structure file
func (p *PathBuilder) Folders() string {
	return filepath.Join(p.dataPath, "folders.json")
}

// Settings returns the path to the settings file
func (p *PathBuilder) Settings() string {
	return filepath.Join(p.dataPath, "settings.json")
}

// TagStore returns the path to the tag store file
func (p *PathBuilder) TagStore() string {
	return filepath.Join(p.dataPath, "tags.json")
}

// DocumentsDir returns the path to the documents directory
func (p *PathBuilder) DocumentsDir() string {
	return filepath.Join(p.dataPath, "documents")
}

// FilesDir returns the path to the external files directory
func (p *PathBuilder) FilesDir() string {
	return filepath.Join(p.dataPath, "files")
}

// Document returns the path to a specific document file
func (p *PathBuilder) Document(id string) string {
	return filepath.Join(p.DocumentsDir(), id+".json")
}

// File returns the path to a specific external file
func (p *PathBuilder) File(name string) string {
	return filepath.Join(p.FilesDir(), name)
}

// ImagesDir returns the path to the images directory
func (p *PathBuilder) ImagesDir() string {
	return filepath.Join(p.dataPath, "images")
}

// TempDir returns the path to the temporary directory
func (p *PathBuilder) TempDir() string {
	return filepath.Join(p.dataPath, "temp")
}

// RAGStore returns the path to the RAG vector store directory
func (p *PathBuilder) RAGStore() string {
	return filepath.Join(p.dataPath, "rag_store")
}

// RAGDatabase returns the path to the RAG vector database file
func (p *PathBuilder) RAGDatabase() string {
	return filepath.Join(p.dataPath, "vectors.db")
}

// RAGConfig returns the path to the RAG configuration file
func (p *PathBuilder) RAGConfig() string {
	return filepath.Join(p.dataPath, "rag_config.json")
}
