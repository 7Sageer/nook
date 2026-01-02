package fileextract

// Extractor interface for different file types
type Extractor interface {
	// Extract extracts text from the given file path
	Extract(filePath string) (string, error)
	// SupportedExtensions returns a list of file extensions supported by this extractor (e.g. ".pdf")
	SupportedExtensions() []string
}
