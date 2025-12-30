package opengraph

import (
	"fmt"
	"testing"
)

func TestFetch(t *testing.T) {
	url := "https://baoyu.io/blog/luck-surface-area-formula-good-luck"

	metadata, err := Fetch(url)
	if err != nil {
		t.Fatalf("Fetch failed: %v", err)
	}

	fmt.Printf("=== Fetch (Metadata) Result ===\n")
	fmt.Printf("URL: %s\n", metadata.URL)
	fmt.Printf("Title: %s\n", metadata.Title)
	fmt.Printf("Description: %s\n", metadata.Description)
	fmt.Printf("Image: %s\n", metadata.Image)
	fmt.Printf("Favicon: %s\n", metadata.Favicon)
	fmt.Printf("SiteName: %s\n", metadata.SiteName)
}

func TestFetchContent(t *testing.T) {
	url := "https://baoyu.io/blog/luck-surface-area-formula-good-luck"

	content, err := FetchContent(url)
	if err != nil {
		t.Fatalf("FetchContent failed: %v", err)
	}

	fmt.Printf("=== FetchContent Result ===\n")
	fmt.Printf("URL: %s\n", content.URL)
	fmt.Printf("Title: %s\n", content.Title)
	fmt.Printf("SiteName: %s\n", content.SiteName)
	fmt.Printf("Byline: %s\n", content.Byline)
	fmt.Printf("Excerpt: %s\n", content.Excerpt)
	fmt.Printf("TextContent length: %d chars\n", len(content.TextContent))
	fmt.Printf("\n=== TextContent (first 500 chars) ===\n")
	if len(content.TextContent) > 500 {
		fmt.Printf("%s...\n", content.TextContent[:500])
	} else {
		fmt.Printf("%s\n", content.TextContent)
	}

	// 验证内容不为空
	if content.TextContent == "" {
		t.Error("TextContent is empty")
	}
	if content.Title == "" {
		t.Error("Title is empty")
	}
}
