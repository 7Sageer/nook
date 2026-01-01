package opengraph

import (
	"context"
	"net/http"
	"net/url"
	"strings"
	"time"

	readability "github.com/go-shiori/go-readability"
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

// LinkContent 网页正文内容
type LinkContent struct {
	URL         string `json:"url"`
	Title       string `json:"title"`
	TextContent string `json:"textContent"`
	Excerpt     string `json:"excerpt"`
	SiteName    string `json:"siteName"`
	Byline      string `json:"byline"`
}

// FetchContent 使用 go-readability 提取网页正文内容
func FetchContent(targetURL string) (*LinkContent, error) {
	// 创建带超时的 HTTP 客户端
	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	// 创建请求
	req, err := http.NewRequest("GET", targetURL, nil)
	if err != nil {
		return nil, err
	}

	// 设置 User-Agent 避免被拒绝
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")

	// 发送请求
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()

	// 解析 URL
	parsedURL, err := url.Parse(targetURL)
	if err != nil {
		return nil, err
	}

	// 使用 readability 提取正文
	article, err := readability.FromReader(resp.Body, parsedURL)
	if err != nil {
		return nil, err
	}

	return &LinkContent{
		URL:         targetURL,
		Title:       article.Title,
		TextContent: article.TextContent,
		Excerpt:     article.Excerpt,
		SiteName:    article.SiteName,
		Byline:      article.Byline,
	}, nil
}
