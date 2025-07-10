package httpclient

import (
	"context"
	"testing"
	"time"
)

func TestNewClient(t *testing.T) {
	client := NewClient()
	if client == nil {
		t.Fatal("NewClient() returned nil")
	}
	if client.client == nil {
		t.Fatal("NewClient() returned client with nil http.Client")
	}

	// Verify default timeout is set
	if client.client.Timeout != 30*time.Second {
		t.Errorf("Expected default timeout 30s, got %v", client.client.Timeout)
	}
}

func TestNewClientWithOptions(t *testing.T) {
	customTimeout := 10 * time.Second
	client := NewClient(WithTimeout(customTimeout))

	if client.client.Timeout != customTimeout {
		t.Errorf("Expected timeout %v, got %v", customTimeout, client.client.Timeout)
	}
}

func TestClientImplementsHTTPClient(t *testing.T) {
	// Compile-time check that Client implements HTTPClient
	var _ HTTPClient = (*Client)(nil)
}

func TestReadResponseBody_NilResponse(t *testing.T) {
	data, err := ReadResponseBody(nil)
	if err != nil {
		t.Errorf("ReadResponseBody(nil) should not return error, got: %v", err)
	}
	if data != nil {
		t.Errorf("ReadResponseBody(nil) should return nil data, got: %v", data)
	}
}

func TestGetWithContext(t *testing.T) {
	client := NewClient()
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Millisecond)
	defer cancel()

	// This should timeout quickly
	_, err := client.GetWithContext(ctx, "https://httpbin.org/delay/5")
	if err == nil {
		t.Error("Expected context timeout error")
	}
}
