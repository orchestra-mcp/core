package auth

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	_ "github.com/lib/pq"
)

// contextKey is an unexported type for context keys in this package.
type contextKey string

const userContextKey contextKey = "userContext"

// UserContext holds the authenticated user's identity and permissions.
type UserContext struct {
	TokenID string
	UserID  string
	OrgID   string
	Scopes  []string
	Plan    string
	Limits  map[string]interface{}
}

// FromContext extracts the UserContext from the request context.
func FromContext(ctx context.Context) (*UserContext, bool) {
	uc, ok := ctx.Value(userContextKey).(*UserContext)
	return uc, ok
}

// WithUserContext returns a new context with the given UserContext attached.
func WithUserContext(ctx context.Context, uc *UserContext) context.Context {
	return context.WithValue(ctx, userContextKey, uc)
}

// UserContextFromContext extracts the UserContext from ctx.
// Unlike FromContext it returns only the UserContext (nil when absent).
func UserContextFromContext(ctx context.Context) *UserContext {
	uc, _ := FromContext(ctx)
	return uc
}

// TokenMiddleware validates API tokens against the database.
type TokenMiddleware struct {
	db *sql.DB
}

// NewTokenMiddleware creates a new TokenMiddleware with a direct PostgreSQL connection.
func NewTokenMiddleware(dbURL string) (*TokenMiddleware, error) {
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		return nil, fmt.Errorf("auth: failed to open database: %w", err)
	}

	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("auth: failed to ping database: %w", err)
	}

	return &TokenMiddleware{db: db}, nil
}

// Close closes the underlying database connection.
func (m *TokenMiddleware) Close() error {
	if m.db != nil {
		return m.db.Close()
	}
	return nil
}

// HashToken computes the SHA-256 hex hash of a raw token string.
func HashToken(rawToken string) string {
	h := sha256.Sum256([]byte(rawToken))
	return hex.EncodeToString(h[:])
}

// Validate checks the given token hash by calling the validate_mcp_token database function.
// It returns the associated user context or an error.
func (m *TokenMiddleware) Validate(tokenHash string) (*UserContext, error) {
	row := m.db.QueryRow(
		`SELECT token_id, user_id, organization_id, scopes, plan, limits
		 FROM validate_mcp_token($1)`,
		tokenHash,
	)

	var (
		tokenID string
		userID  string
		orgID   string
		scopes  string // JSON array as text
		plan    string
		limits  string // JSON object as text
	)

	if err := row.Scan(&tokenID, &userID, &orgID, &scopes, &plan, &limits); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("auth: invalid or expired token")
		}
		return nil, fmt.Errorf("auth: validation failed: %w", err)
	}

	uc := &UserContext{
		TokenID: tokenID,
		UserID:  userID,
		OrgID:   orgID,
		Plan:    plan,
	}

	// Parse scopes JSON array.
	if scopes != "" {
		if err := json.Unmarshal([]byte(scopes), &uc.Scopes); err != nil {
			slog.Warn("auth: failed to parse scopes", "error", err, "raw", scopes)
			uc.Scopes = []string{}
		}
	}

	// Parse limits JSON object.
	if limits != "" {
		uc.Limits = make(map[string]interface{})
		if err := json.Unmarshal([]byte(limits), &uc.Limits); err != nil {
			slog.Warn("auth: failed to parse limits", "error", err, "raw", limits)
			uc.Limits = map[string]interface{}{}
		}
	}

	return uc, nil
}

// ExtractToken extracts the bearer token from the Authorization header or the "token" query parameter.
func ExtractToken(r *http.Request) string {
	// Check Authorization header first.
	authHeader := r.Header.Get("Authorization")
	if authHeader != "" {
		const prefix = "Bearer "
		if strings.HasPrefix(authHeader, prefix) {
			return strings.TrimSpace(authHeader[len(prefix):])
		}
	}

	// Fall back to query parameter.
	return r.URL.Query().Get("token")
}

// Middleware returns an HTTP middleware that validates the token and injects UserContext into the request context.
func (m *TokenMiddleware) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rawToken := ExtractToken(r)
		if rawToken == "" {
			http.Error(w, `{"error":"missing authentication token"}`, http.StatusUnauthorized)
			return
		}

		tokenHash := HashToken(rawToken)

		uc, err := m.Validate(tokenHash)
		if err != nil {
			slog.Warn("auth: token validation failed", "error", err, "remote", r.RemoteAddr)
			http.Error(w, `{"error":"invalid or expired token"}`, http.StatusUnauthorized)
			return
		}

		// Inject user context into the request context.
		ctx := context.WithValue(r.Context(), userContextKey, uc)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
