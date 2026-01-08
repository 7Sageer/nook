package rag

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"
)

// ModelInfo represents a model available from a provider
type ModelInfo struct {
	Name string `json:"name"`
}

// ListModels fetches available models from the specified provider
func ListModels(provider, baseURL, apiKey string) ([]string, error) {
	switch provider {
	case "ollama":
		return ListOllamaModels(baseURL)
	case "openai":
		return ListOpenAIModels(baseURL, apiKey)
	default:
		return nil, fmt.Errorf("unknown provider: %s", provider)
	}
}

// ListOllamaModels fetches models from Ollama API
func ListOllamaModels(baseURL string) ([]string, error) {
	client := &http.Client{Timeout: 10 * time.Second}

	resp, err := client.Get(baseURL + "/api/tags")
	if err != nil {
		return nil, fmt.Errorf("failed to connect to Ollama: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Ollama returned status %d", resp.StatusCode)
	}

	var result struct {
		Models []struct {
			Name string `json:"name"`
		} `json:"models"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to parse Ollama response: %w", err)
	}

	models := make([]string, 0, len(result.Models))
	for _, m := range result.Models {
		// Clean up model names (remove :latest suffix for cleaner display)
		name := m.Name
		if strings.HasSuffix(name, ":latest") {
			name = strings.TrimSuffix(name, ":latest")
		}
		models = append(models, name)
	}

	sort.Strings(models)
	return models, nil
}

// ListOpenAIModels fetches models from OpenAI-compatible API
func ListOpenAIModels(baseURL, apiKey string) ([]string, error) {
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}

	client := &http.Client{Timeout: 10 * time.Second}

	req, err := http.NewRequest("GET", baseURL+"/models", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to OpenAI API: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode == http.StatusUnauthorized {
		return nil, fmt.Errorf("invalid API key")
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API returned status %d", resp.StatusCode)
	}

	var result struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to parse API response: %w", err)
	}

	// Filter for embedding models only
	models := make([]string, 0)
	for _, m := range result.Data {
		// Include common embedding model patterns
		id := strings.ToLower(m.ID)
		if strings.Contains(id, "embed") ||
			strings.Contains(id, "bge") ||
			strings.Contains(id, "e5") ||
			strings.Contains(id, "gte") {
			models = append(models, m.ID)
		}
	}

	// If no embedding models found, return all models
	if len(models) == 0 {
		for _, m := range result.Data {
			models = append(models, m.ID)
		}
	}

	sort.Strings(models)
	return models, nil
}
