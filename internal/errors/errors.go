// Package errors provides structured error handling for claude-cmd.
package errors

import (
	"errors"
	"fmt"
)

// Common error types used throughout the application.
var (
	// ErrInvalidInput indicates invalid user input
	ErrInvalidInput = errors.New("invalid input")
	// ErrNotFound indicates a resource was not found
	ErrNotFound = errors.New("not found")
	// ErrNetwork indicates a network-related error
	ErrNetwork = errors.New("network error")
	// ErrFileSystem indicates a filesystem-related error
	ErrFileSystem = errors.New("filesystem error")
	// ErrValidation indicates validation failure
	ErrValidation = errors.New("validation error")
)

// CommandError represents application-specific errors with additional context.
type CommandError struct {
	Operation string // The operation that failed
	Err       error  // The underlying error
	Context   string // Additional context
}

// Error implements the error interface.
func (e *CommandError) Error() string {
	if e.Context != "" {
		return fmt.Sprintf("%s failed: %s (%s)", e.Operation, e.Err.Error(), e.Context)
	}
	return fmt.Sprintf("%s failed: %s", e.Operation, e.Err.Error())
}

// Unwrap returns the underlying error for error wrapping compatibility.
func (e *CommandError) Unwrap() error {
	return e.Err
}

// NewCommandError creates a new CommandError with the specified operation and error.
func NewCommandError(operation string, err error, context ...string) *CommandError {
	cmdErr := &CommandError{
		Operation: operation,
		Err:       err,
	}
	if len(context) > 0 {
		cmdErr.Context = context[0]
	}
	return cmdErr
}

// Wrap wraps an error with additional context while preserving the error chain.
func Wrap(err error, message string) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf("%s: %w", message, err)
}

// Is checks if the error chain contains the target error.
func Is(err, target error) bool {
	return errors.Is(err, target)
}

// As finds the first error in the error chain that matches the target type.
func As(err error, target interface{}) bool {
	return errors.As(err, target)
}

// IsNotFound checks if an error indicates a resource was not found.
func IsNotFound(err error) bool {
	return errors.Is(err, ErrNotFound)
}

// IsValidation checks if an error indicates validation failure.
func IsValidation(err error) bool {
	return errors.Is(err, ErrValidation)
}

// IsNetwork checks if an error indicates a network problem.
func IsNetwork(err error) bool {
	return errors.Is(err, ErrNetwork)
}

// UserFriendlyError converts technical errors to user-friendly messages.
func UserFriendlyError(err error) string {
	if err == nil {
		return ""
	}

	// Check for known error types
	switch {
	case IsNotFound(err):
		return "The requested resource was not found"
	case IsValidation(err):
		return "The provided data is invalid"
	case IsNetwork(err):
		return "Network connection failed. Please check your internet connection"
	default:
		// For CommandError, provide more context
		var cmdErr *CommandError
		if errors.As(err, &cmdErr) {
			return fmt.Sprintf("Failed to %s: %s", cmdErr.Operation, cmdErr.Err.Error())
		}
		return err.Error()
	}
}
