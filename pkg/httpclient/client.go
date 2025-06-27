package httpclient

import (
	"io"
	"net/http"
)

// HTTPClient defines the interface for HTTP operations
type HTTPClient interface {
	Get(url string) (*http.Response, error)
}

// Client wraps http.Client to implement HTTPClient interface
type Client struct {
	*http.Client
}

// NewClient creates a new HTTP client
func NewClient() *Client {
	return &Client{
		Client: &http.Client{},
	}
}

// Get performs a GET request
func (c *Client) Get(url string) (*http.Response, error) {
	return c.Client.Get(url)
}

// ReadResponseBody is a helper function to read and close response body
func ReadResponseBody(resp *http.Response) ([]byte, error) {
	defer resp.Body.Close()
	return io.ReadAll(resp.Body)
}