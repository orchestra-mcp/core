package auth

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// RateLimiter implements per-organization token-bucket rate limiting.
type RateLimiter struct {
	mu      sync.Mutex
	buckets map[string]*bucket // key: org_id
	limits  map[string]int     // plan -> requests per minute
}

type bucket struct {
	tokens     float64
	lastFill   time.Time
	ratePerSec float64
	maxTokens  float64
}

// NewRateLimiter creates a RateLimiter with default plan limits.
func NewRateLimiter() *RateLimiter {
	return &RateLimiter{
		buckets: make(map[string]*bucket),
		limits: map[string]int{
			"free":       10,   // 10 req/min
			"pro":        60,   // 60 req/min
			"team":       200,  // 200 req/min
			"enterprise": 1000, // 1000 req/min
		},
	}
}

// Allow checks whether the given org is allowed to make a request under its plan.
// It consumes one token from the bucket if available.
func (rl *RateLimiter) Allow(orgID, plan string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	b, ok := rl.buckets[orgID]
	if !ok {
		rpm := rl.rpmForPlan(plan)
		ratePerSec := float64(rpm) / 60.0
		b = &bucket{
			tokens:     float64(rpm),
			lastFill:   time.Now(),
			ratePerSec: ratePerSec,
			maxTokens:  float64(rpm),
		}
		rl.buckets[orgID] = b
	}

	// Refill tokens based on elapsed time.
	now := time.Now()
	elapsed := now.Sub(b.lastFill).Seconds()
	b.tokens += elapsed * b.ratePerSec
	if b.tokens > b.maxTokens {
		b.tokens = b.maxTokens
	}
	b.lastFill = now

	if b.tokens < 1 {
		return false
	}

	b.tokens--
	return true
}

// Remaining returns the number of tokens remaining for the given org.
func (rl *RateLimiter) Remaining(orgID, plan string) int {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	b, ok := rl.buckets[orgID]
	if !ok {
		return rl.rpmForPlan(plan)
	}

	// Refill tokens based on elapsed time (read-only peek).
	now := time.Now()
	elapsed := now.Sub(b.lastFill).Seconds()
	tokens := b.tokens + elapsed*b.ratePerSec
	if tokens > b.maxTokens {
		tokens = b.maxTokens
	}

	return int(tokens)
}

// rpmForPlan returns the requests-per-minute limit for the given plan.
func (rl *RateLimiter) rpmForPlan(plan string) int {
	if rpm, ok := rl.limits[plan]; ok {
		return rpm
	}
	// Default to free tier if plan is unknown.
	return rl.limits["free"]
}

// Middleware returns an HTTP middleware that enforces rate limits.
// It expects UserContext to be present in the request context (set by auth middleware).
func (rl *RateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		uc := UserContextFromContext(r.Context())
		if uc == nil {
			// No auth context — let the request through (auth middleware will catch it).
			next.ServeHTTP(w, r)
			return
		}

		remaining := rl.Remaining(uc.OrgID, uc.Plan)
		w.Header().Set("X-RateLimit-Limit", fmt.Sprintf("%d", rl.rpmForPlan(uc.Plan)))
		w.Header().Set("X-RateLimit-Remaining", fmt.Sprintf("%d", remaining))

		if !rl.Allow(uc.OrgID, uc.Plan) {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Retry-After", "60")
			w.WriteHeader(http.StatusTooManyRequests)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "rate limit exceeded — upgrade your plan for higher limits",
			})
			return
		}

		next.ServeHTTP(w, r)
	})
}
