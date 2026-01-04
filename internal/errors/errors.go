package errors

import "errors"

// Standard Error Types
var (
	ErrNotFound      = errors.New("not found")
	ErrInvalidParams = errors.New("invalid parameters")
	ErrInternal      = errors.New("internal server error")
	ErrAlreadyExists = errors.New("already exists")
)

// New creates a new error
func New(text string) error {
	return errors.New(text)
}

// Is reports whether any error in err's chain matches target.
func Is(err, target error) bool {
	return errors.Is(err, target)
}
