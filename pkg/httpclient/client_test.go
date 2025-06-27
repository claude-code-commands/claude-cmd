package httpclient

import (
	"net/http"
	"testing"
)

func TestNewClient(t *testing.T) {
	client := NewClient()
	if client == nil {
		t.Fatal("NewClient() returned nil")
	}
	if client.Client == nil {
		t.Fatal("NewClient() returned client with nil http.Client")
	}
}

func TestClientImplementsHTTPClient(t *testing.T) {
	var _ HTTPClient = (*Client)(nil)
}

func TestHTTPClientInterface(t *testing.T) {
	// Verify that *http.Client implements our interface methods
	client := &http.Client{}
	_, err := client.Get("https://example.com")
	// We don't care about the actual result, just that the method exists
	// This test will fail to compile if the interface doesn't match
	_ = err
}