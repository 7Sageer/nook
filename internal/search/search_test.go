package search

import (
	"strings"
	"testing"
)

func TestExtractTextFromBlocks(t *testing.T) {
	jsonContent := `[
		{
			"id": "block-1",
			"type": "header",
			"content": "Hello World",
			"props": {"level": 1}
		},
		{
			"id": "block-2",
			"type": "paragraph",
			"content": "This is a paragraph with <b>bold</b> text.",
			"children": [
				{
					"id": "block-3",
					"type": "text",
					"content": "Nested content here."
				}
			]
		}
	]`

	text := ExtractTextFromBlocks(jsonContent)
	// We expect "Hello World This is a paragraph with  bold  text. Nested content here. "
	// Note: Our stripHTML replaces tags with spaces.

	if !strings.Contains(text, "Hello World") {
		t.Errorf("Expected text to contain 'Hello World', got: %s", text)
	}
	if !strings.Contains(text, "Nested content here") {
		t.Errorf("Expected text to contain 'Nested content here', got: %s", text)
	}
	if strings.Contains(text, "block-1") {
		t.Errorf("Expected text NOT to contain 'block-1' (JSON ID), got: %s", text)
	}
	if strings.Contains(text, "header") {
		t.Errorf("Expected text NOT to contain 'header' (JSON value), got: %s", text)
	}
}

func TestIndexSearch(t *testing.T) {
	idx := NewIndex()

	jsonContent := `[{"id":"1","content":"Apple Banana Cherry"}]`
	idx.Update("doc1", jsonContent)

	matches := idx.Search("Banana")
	if len(matches) != 1 || matches[0] != "doc1" {
		t.Errorf("Expected match for 'Banana', got %v", matches)
	}

	matches = idx.Search("apple") // Case insensitive
	if len(matches) != 1 || matches[0] != "doc1" {
		t.Errorf("Expected match for 'apple', got %v", matches)
	}

	matches = idx.Search("id") // Should not match JSON key
	if len(matches) != 0 {
		t.Errorf("Expected no match for 'id', got %v", matches)
	}
}
