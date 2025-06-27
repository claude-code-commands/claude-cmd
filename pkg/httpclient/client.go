// Package httpclient provides HTTP client abstractions for testability.
package httpclient

import (
	"context"
	"io"
	"net/http"
	"time"
)

// HTTPClient defines the interface for HTTP operations.
// This interface allows for easy mocking in tests.
type HTTPClient interface {
	// Get performs an HTTP GET request to the specified URL
	Get(url string) (*http.Response, error)
	// GetWithContext performs an HTTP GET request with context
	GetWithContext(ctx context.Context, url string) (*http.Response, error)
}

// Client wraps http.Client to implement HTTPClient interface.
type Client struct {
	client *http.Client
}

// ClientOption configures the HTTP client.
type ClientOption func(*Client)

// WithTimeout sets the HTTP client timeout.
func WithTimeout(timeout time.Duration) ClientOption {
	return func(c *Client) {
		c.client.Timeout = timeout
	}
}

// NewClient creates a new HTTP client with optional configuration.
func NewClient(opts ...ClientOption) *Client {
	c := &Client{
		client: &http.Client{
			Timeout: 30 * time.Second, // reasonable default
		},
	}
	
	for _, opt := range opts {
		opt(c)
	}
	
	return c
}

// Get performs a GET request.
func (c *Client) Get(url string) (*http.Response, error) {
	return c.client.Get(url)
}

// GetWithContext performs a GET request with context.
func (c *Client) GetWithContext(ctx context.Context, url string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	return c.client.Do(req)
}

// ReadResponseBody is a helper function to read and close response body.
// It ensures the response body is always closed to prevent resource leaks.
func ReadResponseBody(resp *http.Response) ([]byte, error) {
	if resp == nil {
		return nil, nil
	}
	defer func() {
		if closeErr := resp.Body.Close(); closeErr != nil {
			// Log error in real implementation
			_ = closeErr
		}
	}()
	return io.ReadAll(resp.Body)
}