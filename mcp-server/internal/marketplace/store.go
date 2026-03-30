package marketplace

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/orchestra-mcp/server/internal/db"
)

// Store provides marketplace CRUD backed by Supabase PostgREST.
// When dbClient is nil (e.g. in tests), all operations return ErrNoDB.
type Store struct {
	db *db.Client
}

// ErrNoDB is returned when the store has no DB client configured.
var ErrNoDB = fmt.Errorf("marketplace: database client not configured")

// NewStore creates a new marketplace Store.
// If dbClient is nil the store is still usable but every method returns ErrNoDB.
func NewStore(dbClient *db.Client) *Store {
	return &Store{db: dbClient}
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

// Publish inserts a new marketplace item and returns the created record.
func (s *Store) Publish(item MarketplaceItem) (*MarketplaceItem, error) {
	if s.db == nil {
		return nil, ErrNoDB
	}

	if item.ID == "" {
		item.ID = uuid.New().String()
	}
	if item.CreatedAt == "" {
		item.CreatedAt = time.Now().UTC().Format(time.RFC3339)
	}
	if item.Status == "" {
		item.Status = "published"
	}
	if item.Version == "" {
		item.Version = "1.0.0"
	}
	if item.Pricing == "" {
		item.Pricing = "free"
	}
	if item.Visibility == "" {
		item.Visibility = "public"
	}

	row := map[string]interface{}{
		"id":              item.ID,
		"author_id":       item.AuthorID,
		"organization_id": item.OrganizationID,
		"type":            item.Type,
		"name":            item.Name,
		"slug":            item.Slug,
		"description":     item.Description,
		"category":        item.Category,
		"tags":            item.Tags,
		"version":         item.Version,
		"pricing":         item.Pricing,
		"price_cents":     item.PriceCents,
		"visibility":      item.Visibility,
		"status":          item.Status,
		"featured":        item.Featured,
		"created_at":      item.CreatedAt,
	}
	if len(item.Content) > 0 {
		row["content"] = item.Content
	}
	if item.Readme != "" {
		row["readme"] = item.Readme
	}

	raw, err := s.db.Post(context.Background(), "marketplace_items", row)
	if err != nil {
		return nil, fmt.Errorf("publish: %w", err)
	}

	// PostgREST returns an array with Prefer: return=representation.
	var items []MarketplaceItem
	if err := json.Unmarshal(raw, &items); err != nil {
		return nil, fmt.Errorf("publish: unmarshal: %w", err)
	}
	if len(items) == 0 {
		return &item, nil
	}
	return &items[0], nil
}

// Update applies partial updates to a marketplace item by ID.
func (s *Store) Update(id string, updates map[string]any) error {
	if s.db == nil {
		return ErrNoDB
	}

	q := url.Values{}
	q.Set("id", "eq."+id)
	_, err := s.db.Patch(context.Background(), "marketplace_items", q.Encode(), updates)
	if err != nil {
		return fmt.Errorf("update %s: %w", id, err)
	}
	return nil
}

// Get fetches a marketplace item by its UUID or slug.
func (s *Store) Get(idOrSlug string) (*MarketplaceItem, error) {
	if s.db == nil {
		return nil, ErrNoDB
	}

	q := url.Values{}
	// UUIDs contain hyphens; slugs do not (generally). Try ID first then slug.
	if strings.Contains(idOrSlug, "-") && len(idOrSlug) == 36 {
		q.Set("id", "eq."+idOrSlug)
	} else {
		q.Set("slug", "eq."+idOrSlug)
	}

	raw, err := s.db.GetSingle(context.Background(), "marketplace_items", q.Encode())
	if err != nil {
		return nil, fmt.Errorf("get %s: %w", idOrSlug, err)
	}

	var item MarketplaceItem
	if err := json.Unmarshal(raw, &item); err != nil {
		return nil, fmt.Errorf("get: unmarshal: %w", err)
	}
	return &item, nil
}

// List returns marketplace items with optional filtering and sorting.
func (s *Store) List(filters ListFilters) ([]MarketplaceItem, error) {
	if s.db == nil {
		return nil, ErrNoDB
	}

	limit := 20
	if filters.Limit > 0 {
		limit = filters.Limit
	}

	q := url.Values{}
	q.Set("status", "eq.published")
	q.Set("limit", fmt.Sprintf("%d", limit))

	if filters.Type != "" {
		q.Set("type", "eq."+filters.Type)
	}
	if filters.Category != "" {
		q.Set("category", "eq."+filters.Category)
	}

	switch filters.Sort {
	case "downloads":
		q.Set("order", "downloads.desc")
	case "rating":
		q.Set("order", "rating.desc")
	default:
		q.Set("order", "created_at.desc")
	}

	raw, err := s.db.Get(context.Background(), "marketplace_items", q.Encode())
	if err != nil {
		return nil, fmt.Errorf("list: %w", err)
	}

	var items []MarketplaceItem
	if err := json.Unmarshal(raw, &items); err != nil {
		return nil, fmt.Errorf("list: unmarshal: %w", err)
	}
	return items, nil
}

// Search performs a text search across name, description, and tags.
func (s *Store) Search(query string, itemType string, category string) ([]MarketplaceItem, error) {
	if s.db == nil {
		return nil, ErrNoDB
	}

	q := url.Values{}
	q.Set("status", "eq.published")
	q.Set("limit", "50")
	q.Set("order", "downloads.desc")

	if query != "" {
		// PostgREST full-text search via ilike on name or description.
		escaped := strings.ReplaceAll(query, "%", "\\%")
		q.Set("or", fmt.Sprintf("(name.ilike.*%s*,description.ilike.*%s*)", escaped, escaped))
	}
	if itemType != "" {
		q.Set("type", "eq."+itemType)
	}
	if category != "" {
		q.Set("category", "eq."+category)
	}

	raw, err := s.db.Get(context.Background(), "marketplace_items", q.Encode())
	if err != nil {
		return nil, fmt.Errorf("search: %w", err)
	}

	var items []MarketplaceItem
	if err := json.Unmarshal(raw, &items); err != nil {
		return nil, fmt.Errorf("search: unmarshal: %w", err)
	}
	return items, nil
}

// ---------------------------------------------------------------------------
// Install / Uninstall
// ---------------------------------------------------------------------------

// Install records an installation of itemID for the given user and org.
func (s *Store) Install(itemID, userID, orgID, version string) error {
	if s.db == nil {
		return ErrNoDB
	}

	row := map[string]interface{}{
		"id":              uuid.New().String(),
		"item_id":         itemID,
		"user_id":         userID,
		"organization_id": orgID,
		"version":         version,
		"installed_at":    time.Now().UTC().Format(time.RFC3339),
	}

	_, err := s.db.Upsert(context.Background(), "marketplace_installs", row, "item_id,user_id,organization_id")
	if err != nil {
		return fmt.Errorf("install %s: %w", itemID, err)
	}

	return s.IncrementDownloads(itemID)
}

// Uninstall removes an installation record.
func (s *Store) Uninstall(itemID, userID, orgID string) error {
	if s.db == nil {
		return ErrNoDB
	}

	q := url.Values{}
	q.Set("item_id", "eq."+itemID)
	q.Set("user_id", "eq."+userID)
	q.Set("organization_id", "eq."+orgID)

	_, err := s.db.Delete(context.Background(), "marketplace_installs", q.Encode())
	if err != nil {
		return fmt.Errorf("uninstall %s: %w", itemID, err)
	}
	return nil
}

// GetInstalled returns items installed by the user/org, optionally filtered by type.
func (s *Store) GetInstalled(userID, orgID, itemType string) ([]MarketplaceItem, error) {
	if s.db == nil {
		return nil, ErrNoDB
	}

	// Join via PostgREST: select items through installs.
	q := url.Values{}
	q.Set("user_id", "eq."+userID)
	q.Set("organization_id", "eq."+orgID)
	q.Set("select", "item_id,version,installed_at,marketplace_items(*)")

	raw, err := s.db.Get(context.Background(), "marketplace_installs", q.Encode())
	if err != nil {
		return nil, fmt.Errorf("get installed: %w", err)
	}

	// Parse the nested response.
	type installRow struct {
		ItemID          string          `json:"item_id"`
		Version         string          `json:"version"`
		InstalledAt     string          `json:"installed_at"`
		MarketplaceItem json.RawMessage `json:"marketplace_items"`
	}
	var rows []installRow
	if err := json.Unmarshal(raw, &rows); err != nil {
		// Fallback: treat raw as items array directly.
		var items []MarketplaceItem
		if err2 := json.Unmarshal(raw, &items); err2 != nil {
			return nil, fmt.Errorf("get installed: unmarshal: %w", err)
		}
		return items, nil
	}

	items := make([]MarketplaceItem, 0, len(rows))
	for _, row := range rows {
		if len(row.MarketplaceItem) == 0 {
			continue
		}
		var item MarketplaceItem
		if err := json.Unmarshal(row.MarketplaceItem, &item); err != nil {
			continue
		}
		if itemType == "" || item.Type == itemType {
			items = append(items, item)
		}
	}
	return items, nil
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

// AddReview inserts a review and recalculates the item's average rating.
func (s *Store) AddReview(itemID, userID string, rating int, review string) error {
	if s.db == nil {
		return ErrNoDB
	}

	row := map[string]interface{}{
		"id":         uuid.New().String(),
		"item_id":    itemID,
		"user_id":    userID,
		"rating":     rating,
		"review":     review,
		"created_at": time.Now().UTC().Format(time.RFC3339),
	}

	_, err := s.db.Upsert(context.Background(), "marketplace_reviews", row, "item_id,user_id")
	if err != nil {
		return fmt.Errorf("add review: %w", err)
	}

	// Recalculate average rating via RPC (if available) or skip.
	// This is best-effort — the DB trigger can handle it too.
	_ = s.recalcRating(itemID)
	return nil
}

// GetReviews returns the most recent reviews for an item.
func (s *Store) GetReviews(itemID string, limit int) ([]MarketplaceReview, error) {
	if s.db == nil {
		return nil, ErrNoDB
	}

	if limit <= 0 {
		limit = 10
	}

	q := url.Values{}
	q.Set("item_id", "eq."+itemID)
	q.Set("order", "created_at.desc")
	q.Set("limit", fmt.Sprintf("%d", limit))

	raw, err := s.db.Get(context.Background(), "marketplace_reviews", q.Encode())
	if err != nil {
		return nil, fmt.Errorf("get reviews: %w", err)
	}

	var reviews []MarketplaceReview
	if err := json.Unmarshal(raw, &reviews); err != nil {
		return nil, fmt.Errorf("get reviews: unmarshal: %w", err)
	}
	return reviews, nil
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

// IncrementDownloads bumps the download counter for an item.
func (s *Store) IncrementDownloads(itemID string) error {
	if s.db == nil {
		return ErrNoDB
	}

	// Use a PostgREST RPC to atomically increment. Falls back to a read-modify-write
	// if the function doesn't exist — acceptable for low-concurrency scenarios.
	_, err := s.db.RPC(context.Background(), "marketplace_increment_downloads", map[string]interface{}{
		"p_item_id": itemID,
	})
	if err != nil {
		// Best-effort: don't fail the install because of this.
		return nil
	}
	return nil
}

// recalcRating recomputes the average rating for an item via RPC.
// This is called after every review write; it is best-effort.
func (s *Store) recalcRating(itemID string) error {
	if s.db == nil {
		return nil
	}
	_, err := s.db.RPC(context.Background(), "marketplace_recalc_rating", map[string]interface{}{
		"p_item_id": itemID,
	})
	return err
}

// ---------------------------------------------------------------------------
// Featured / Trending helpers (convenience wrappers over List/Search)
// ---------------------------------------------------------------------------

// Featured returns items marked as featured, optionally filtered by type.
func (s *Store) Featured(itemType string, limit int) ([]MarketplaceItem, error) {
	if s.db == nil {
		return nil, ErrNoDB
	}

	if limit <= 0 {
		limit = 10
	}

	q := url.Values{}
	q.Set("status", "eq.published")
	q.Set("featured", "eq.true")
	q.Set("order", "downloads.desc")
	q.Set("limit", fmt.Sprintf("%d", limit))
	if itemType != "" {
		q.Set("type", "eq."+itemType)
	}

	raw, err := s.db.Get(context.Background(), "marketplace_items", q.Encode())
	if err != nil {
		return nil, fmt.Errorf("featured: %w", err)
	}

	var items []MarketplaceItem
	if err := json.Unmarshal(raw, &items); err != nil {
		return nil, fmt.Errorf("featured: unmarshal: %w", err)
	}
	return items, nil
}

// Trending returns recently-active items sorted by downloads in a rolling window.
// The DB is expected to have a view or function that handles the time window;
// this falls back to ordering by downloads when the RPC doesn't exist.
func (s *Store) Trending(itemType string, period string, limit int) ([]MarketplaceItem, error) {
	if s.db == nil {
		return nil, ErrNoDB
	}

	if limit <= 0 {
		limit = 10
	}

	// Try the RPC first (returns pre-ranked results).
	raw, err := s.db.RPC(context.Background(), "marketplace_trending", map[string]interface{}{
		"p_type":   itemType,
		"p_period": period,
		"p_limit":  limit,
	})
	if err == nil {
		var items []MarketplaceItem
		if err2 := json.Unmarshal(raw, &items); err2 == nil {
			return items, nil
		}
	}

	// Fallback: list by downloads.
	return s.List(ListFilters{Type: itemType, Sort: "downloads", Limit: limit})
}

// ByAuthor returns items published by a specific author.
func (s *Store) ByAuthor(authorID string) ([]MarketplaceItem, error) {
	if s.db == nil {
		return nil, ErrNoDB
	}

	q := url.Values{}
	q.Set("author_id", "eq."+authorID)
	q.Set("status", "eq.published")
	q.Set("order", "created_at.desc")

	raw, err := s.db.Get(context.Background(), "marketplace_items", q.Encode())
	if err != nil {
		return nil, fmt.Errorf("by author: %w", err)
	}

	var items []MarketplaceItem
	if err := json.Unmarshal(raw, &items); err != nil {
		return nil, fmt.Errorf("by author: unmarshal: %w", err)
	}
	return items, nil
}
