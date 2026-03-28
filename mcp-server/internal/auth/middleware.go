package auth

import (
	"errors"

	"github.com/orchestra-mcp/server/internal/db"
)

// UserContext holds the authenticated user's identity and permissions.
type UserContext struct {
	TokenID string
	UserID  string
	OrgID   string
	Scopes  []string
	Plan    string
	Limits  map[string]interface{}
}

// TokenMiddleware validates API tokens against the database.
type TokenMiddleware struct {
	DB *db.Client
}

// NewTokenMiddleware creates a new TokenMiddleware with the given database client.
func NewTokenMiddleware(dbClient *db.Client) *TokenMiddleware {
	return &TokenMiddleware{DB: dbClient}
}

// Validate checks the given token hash and returns the associated user context.
func (m *TokenMiddleware) Validate(tokenHash string) (*UserContext, error) {
	_ = tokenHash // will be used once implemented
	return nil, errors.New("not implemented")
}
