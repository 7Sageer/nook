package opengraph

import (
	"context"
	"net/url"
	"strings"
	"time"

	og "github.com/otiai10/opengraph/v2"
)

// LinkMetadata represents the metadata extracted from a URL
type LinkMetadata struct {
	URL         string `json:"url"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Image       string `json:"image"`
	Favicon     string `json:"favicon"`
	SiteName    string `json:"siteName"`
}

// Fetch retrieves Open Graph metadata from a URL
func Fetch(targetURL string) (*LinkMetadata, error) {
	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Fetch Open Graph data
	ogp, err := og.Fetch(targetURL, og.Intent{Context: ctx})
	if err != nil {
		return nil, err
	}

	// Extract image URL (first image if available)
	var imageURL string
	if len(ogp.Image) > 0 {
		imageURL = ogp.Image[0].URL
	}

	// Extract favicon URL
	var faviconURL string
	if ogp.Favicon.URL != "" {
		faviconURL = ogp.Favicon.URL
	} else {
		// Try to generate favicon from URL
		parsedURL, err := url.Parse(targetURL)
		if err == nil {
			faviconURL = parsedURL.Scheme + "://" + parsedURL.Host + "/favicon.ico"
		}
	}

	// Extract site name
	siteName := ogp.SiteName
	if siteName == "" {
		// Fallback to domain name
		parsedURL, err := url.Parse(targetURL)
		if err == nil {
			siteName = strings.TrimPrefix(parsedURL.Host, "www.")
		}
	}

	return &LinkMetadata{
		URL:         targetURL,
		Title:       ogp.Title,
		Description: ogp.Description,
		Image:       imageURL,
		Favicon:     faviconURL,
		SiteName:    siteName,
	}, nil
}
