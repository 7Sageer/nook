package fileextract

import (
	"strings"
	"sync"
)

var (
	registryMu sync.RWMutex
	registry   = make(map[string]Extractor)
)

// Register registers an extractor for its supported extensions
func Register(extractor Extractor) {
	registryMu.Lock()
	defer registryMu.Unlock()

	for _, ext := range extractor.SupportedExtensions() {
		registry[strings.ToLower(ext)] = extractor
	}
}

// GetExtractor returns the extractor for the given file extension
func GetExtractor(ext string) (Extractor, bool) {
	registryMu.RLock()
	defer registryMu.RUnlock()

	extractor, ok := registry[strings.ToLower(ext)]
	return extractor, ok
}
