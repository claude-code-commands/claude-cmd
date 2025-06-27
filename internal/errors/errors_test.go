package errors

import (
	"errors"
	"fmt"
	"testing"
)

func TestCommandError(t *testing.T) {
	baseErr := errors.New("base error")
	
	tests := []struct {
		name      string
		operation string
		err       error
		context   []string
		want      string
	}{
		{
			name:      "without context",
			operation: "fetch manifest",
			err:       baseErr,
			want:      "fetch manifest failed: base error",
		},
		{
			name:      "with context",
			operation: "parse JSON",
			err:       baseErr,
			context:   []string{"malformed data"},
			want:      "parse JSON failed: base error (malformed data)",
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cmdErr := NewCommandError(tt.operation, tt.err, tt.context...)
			if cmdErr.Error() != tt.want {
				t.Errorf("CommandError.Error() = %q, want %q", cmdErr.Error(), tt.want)
			}
			
			// Test unwrapping
			if !errors.Is(cmdErr, baseErr) {
				t.Error("CommandError should wrap the base error")
			}
		})
	}
}

func TestWrap(t *testing.T) {
	baseErr := errors.New("base error")
	
	wrappedErr := Wrap(baseErr, "additional context")
	expected := "additional context: base error"
	
	if wrappedErr.Error() != expected {
		t.Errorf("Wrap() = %q, want %q", wrappedErr.Error(), expected)
	}
	
	// Test that it preserves error chain
	if !errors.Is(wrappedErr, baseErr) {
		t.Error("Wrap() should preserve error chain")
	}
	
	// Test with nil error
	if Wrap(nil, "message") != nil {
		t.Error("Wrap(nil, message) should return nil")
	}
}

func TestErrorTypeCheckers(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		checker  func(error) bool
		expected bool
	}{
		{
			name:     "IsNotFound with ErrNotFound",
			err:      ErrNotFound,
			checker:  IsNotFound,
			expected: true,
		},
		{
			name:     "IsNotFound with wrapped ErrNotFound",
			err:      fmt.Errorf("wrapped: %w", ErrNotFound),
			checker:  IsNotFound,
			expected: true,
		},
		{
			name:     "IsValidation with ErrValidation",
			err:      ErrValidation,
			checker:  IsValidation,
			expected: true,
		},
		{
			name:     "IsNetwork with ErrNetwork",
			err:      ErrNetwork,
			checker:  IsNetwork,
			expected: true,
		},
		{
			name:     "IsNotFound with different error",
			err:      ErrValidation,
			checker:  IsNotFound,
			expected: false,
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.checker(tt.err)
			if result != tt.expected {
				t.Errorf("%s = %v, want %v", tt.name, result, tt.expected)
			}
		})
	}
}

func TestUserFriendlyError(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want string
	}{
		{
			name: "nil error",
			err:  nil,
			want: "",
		},
		{
			name: "not found error",
			err:  ErrNotFound,
			want: "The requested resource was not found",
		},
		{
			name: "validation error",
			err:  ErrValidation,
			want: "The provided data is invalid",
		},
		{
			name: "network error",
			err:  ErrNetwork,
			want: "Network connection failed. Please check your internet connection",
		},
		{
			name: "command error",
			err:  NewCommandError("download file", errors.New("connection timeout")),
			want: "Failed to download file: connection timeout",
		},
		{
			name: "generic error",
			err:  errors.New("generic error"),
			want: "generic error",
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := UserFriendlyError(tt.err)
			if result != tt.want {
				t.Errorf("UserFriendlyError() = %q, want %q", result, tt.want)
			}
		})
	}
}