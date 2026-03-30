package marketplace

import "encoding/json"

// MarketplaceItem represents a published item in the marketplace.
// Type can be: agent, skill, company, plugin, workflow.
type MarketplaceItem struct {
	ID             string          `json:"id"`
	OrganizationID string          `json:"organization_id"`
	AuthorID       string          `json:"author_id"`
	Type           string          `json:"type"` // agent, skill, company, plugin, workflow
	Name           string          `json:"name"`
	Slug           string          `json:"slug"`
	Description    string          `json:"description"`
	Category       string          `json:"category"`
	Tags           []string        `json:"tags"`
	Version        string          `json:"version"`
	Content        json.RawMessage `json:"content"`
	Readme         string          `json:"readme"`
	Pricing        string          `json:"pricing"` // free, paid, subscription
	PriceCents     int             `json:"price_cents"`
	Visibility     string          `json:"visibility"` // public, private, team
	Status         string          `json:"status"`     // draft, published, archived
	Downloads      int             `json:"downloads"`
	Rating         float64         `json:"rating"`
	RatingCount    int             `json:"rating_count"`
	Featured       bool            `json:"featured"`
	CreatedAt      string          `json:"created_at"`
}

// MarketplaceInstall records an item installation for a user/org.
type MarketplaceInstall struct {
	ID             string `json:"id"`
	ItemID         string `json:"item_id"`
	UserID         string `json:"user_id"`
	OrganizationID string `json:"organization_id"`
	Version        string `json:"version"`
	InstalledAt    string `json:"installed_at"`
}

// MarketplaceReview is a user review for a marketplace item.
type MarketplaceReview struct {
	ID        string `json:"id"`
	ItemID    string `json:"item_id"`
	UserID    string `json:"user_id"`
	Rating    int    `json:"rating"`
	Review    string `json:"review"`
	CreatedAt string `json:"created_at"`
}

// ListFilters holds optional filters for marketplace_list.
type ListFilters struct {
	Type     string
	Category string
	Sort     string // downloads, rating, created
	Limit    int
}
