package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/orchestra-mcp/server/internal/auth"
	"github.com/orchestra-mcp/server/internal/marketplace"
	"github.com/orchestra-mcp/server/internal/mcp"
)

// ---------------------------------------------------------------------------
// JSON Schemas
// ---------------------------------------------------------------------------

var marketplacePublishSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"type":        {"type": "string", "description": "Item type: agent, skill, company, plugin, workflow", "enum": ["agent", "skill", "company", "plugin", "workflow"]},
		"name":        {"type": "string", "description": "Display name of the item"},
		"slug":        {"type": "string", "description": "URL-safe unique identifier (e.g. my-awesome-agent)"},
		"description": {"type": "string", "description": "Short description shown in listings"},
		"category":    {"type": "string", "description": "Category (e.g. productivity, engineering, design)"},
		"tags":        {"type": "array", "items": {"type": "string"}, "description": "Tags for discovery"},
		"content":     {"type": "string", "description": "JSON string containing the item definition (agent config, skill YAML, etc.)"},
		"readme":      {"type": "string", "description": "Full documentation in Markdown"},
		"pricing":     {"type": "string", "description": "Pricing model: free, paid, subscription", "enum": ["free", "paid", "subscription"]},
		"visibility":  {"type": "string", "description": "Visibility: public, private, team", "enum": ["public", "private", "team"]}
	},
	"required": ["type", "name", "slug"]
}`)

var marketplaceUpdateSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"id":      {"type": "string", "description": "Marketplace item ID"},
		"content": {"type": "string", "description": "Updated JSON content"},
		"version": {"type": "string", "description": "New version string (e.g. 1.2.0)"},
		"readme":  {"type": "string", "description": "Updated Markdown documentation"}
	},
	"required": ["id"]
}`)

var marketplaceUnpublishSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"id": {"type": "string", "description": "Marketplace item ID to unpublish"}
	},
	"required": ["id"]
}`)

var marketplaceGetSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"id": {"type": "string", "description": "Marketplace item ID or slug"}
	},
	"required": ["id"]
}`)

var marketplaceListSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"type":     {"type": "string", "description": "Filter by type: agent, skill, company, plugin, workflow"},
		"category": {"type": "string", "description": "Filter by category"},
		"sort":     {"type": "string", "description": "Sort order: downloads, rating, created", "enum": ["downloads", "rating", "created"]},
		"limit":    {"type": "integer", "description": "Maximum results to return (default 20)"}
	}
}`)

var marketplaceSearchSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"query":      {"type": "string", "description": "Full-text search query"},
		"type":       {"type": "string", "description": "Filter by item type"},
		"category":   {"type": "string", "description": "Filter by category"},
		"min_rating": {"type": "number", "description": "Minimum average rating (0–5)"}
	},
	"required": ["query"]
}`)

var marketplaceFeaturedSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"type":  {"type": "string", "description": "Filter featured items by type"},
		"limit": {"type": "integer", "description": "Maximum results (default 10)"}
	}
}`)

var marketplaceTrendingSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"type":   {"type": "string", "description": "Filter by item type"},
		"period": {"type": "string", "description": "Time window: day, week, month", "enum": ["day", "week", "month"]},
		"limit":  {"type": "integer", "description": "Maximum results (default 10)"}
	}
}`)

var marketplaceByAuthorSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"author_id": {"type": "string", "description": "Author user ID"}
	},
	"required": ["author_id"]
}`)

var marketplaceInstallSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"item_id": {"type": "string", "description": "Marketplace item ID to install"}
	},
	"required": ["item_id"]
}`)

var marketplaceUninstallSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"item_id": {"type": "string", "description": "Marketplace item ID to uninstall"}
	},
	"required": ["item_id"]
}`)

var marketplaceInstalledSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"type": {"type": "string", "description": "Filter installed items by type"}
	}
}`)

var marketplaceCheckUpdatesSchema = json.RawMessage(`{
	"type": "object",
	"properties": {}
}`)

var marketplaceReviewSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"item_id": {"type": "string", "description": "Marketplace item ID to review"},
		"rating":  {"type": "integer", "description": "Rating from 1 to 5", "minimum": 1, "maximum": 5},
		"review":  {"type": "string", "description": "Written review text"}
	},
	"required": ["item_id", "rating"]
}`)

var marketplaceReviewsSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"item_id": {"type": "string", "description": "Marketplace item ID"},
		"limit":   {"type": "integer", "description": "Maximum number of reviews to return (default 10)"}
	},
	"required": ["item_id"]
}`)

var marketplaceShareTeamSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"item_id": {"type": "string", "description": "Marketplace item ID"},
		"team_id": {"type": "string", "description": "Team/organization ID to share with"}
	},
	"required": ["item_id", "team_id"]
}`)

var marketplaceSharePublicSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"item_id": {"type": "string", "description": "Marketplace item ID to make public"}
	},
	"required": ["item_id"]
}`)

var marketplaceExportSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"item_id": {"type": "string", "description": "Marketplace item ID to export"}
	},
	"required": ["item_id"]
}`)

var marketplaceImportSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"content": {"type": "string", "description": "JSON string of the exported marketplace item"}
	},
	"required": ["content"]
}`)

var marketplaceForkSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"item_id": {"type": "string", "description": "Marketplace item ID to fork"}
	},
	"required": ["item_id"]
}`)

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

// RegisterMarketplaceTools registers all 20 marketplace_* MCP tools.
func RegisterMarketplaceTools(registry *mcp.ToolRegistry, store *marketplace.Store) {
	// CRUD
	registry.Register(
		"marketplace_publish",
		"Publish a new item to the Orchestra marketplace (agent, skill, company, plugin, or workflow). "+
			"Returns the published item with its assigned ID.",
		marketplacePublishSchema,
		makeMarketplacePublish(store),
	)

	registry.Register(
		"marketplace_update",
		"Update an existing marketplace item's content, version, or readme. "+
			"Only the item author can update.",
		marketplaceUpdateSchema,
		makeMarketplaceUpdate(store),
	)

	registry.Register(
		"marketplace_unpublish",
		"Unpublish a marketplace item (sets status to archived). "+
			"The item will no longer appear in listings or search.",
		marketplaceUnpublishSchema,
		makeMarketplaceUnpublish(store),
	)

	registry.Register(
		"marketplace_get",
		"Get full details of a marketplace item by ID or slug, "+
			"including content, readme, ratings, and install count.",
		marketplaceGetSchema,
		makeMarketplaceGet(store),
	)

	registry.Register(
		"marketplace_list",
		"List published marketplace items with optional type/category filtering and sorting by downloads, rating, or creation date.",
		marketplaceListSchema,
		makeMarketplaceList(store),
	)

	// Discovery
	registry.Register(
		"marketplace_search",
		"Full-text search across marketplace items by name and description. "+
			"Optionally filter by type, category, or minimum rating.",
		marketplaceSearchSchema,
		makeMarketplaceSearch(store),
	)

	registry.Register(
		"marketplace_featured",
		"Return hand-picked featured items from the marketplace, optionally filtered by type.",
		marketplaceFeaturedSchema,
		makeMarketplaceFeatured(store),
	)

	registry.Register(
		"marketplace_trending",
		"Return trending marketplace items ranked by recent download activity. "+
			"Period can be: day, week, month.",
		marketplaceTrendingSchema,
		makeMarketplaceTrending(store),
	)

	registry.Register(
		"marketplace_by_author",
		"List all published marketplace items by a specific author ID.",
		marketplaceByAuthorSchema,
		makeMarketplaceByAuthor(store),
	)

	// Install
	registry.Register(
		"marketplace_install",
		"Install a marketplace item for the current user and organization. "+
			"Increments the download counter and records the install.",
		marketplaceInstallSchema,
		makeMarketplaceInstall(store),
	)

	registry.Register(
		"marketplace_uninstall",
		"Uninstall a previously installed marketplace item.",
		marketplaceUninstallSchema,
		makeMarketplaceUninstall(store),
	)

	registry.Register(
		"marketplace_installed",
		"List all marketplace items installed by the current user, optionally filtered by type.",
		marketplaceInstalledSchema,
		makeMarketplaceInstalled(store),
	)

	registry.Register(
		"marketplace_check_updates",
		"Check if any installed marketplace items have newer versions available in the marketplace.",
		marketplaceCheckUpdatesSchema,
		makeMarketplaceCheckUpdates(store),
	)

	// Reviews
	registry.Register(
		"marketplace_review",
		"Submit a rating and optional written review for a marketplace item (1–5 stars).",
		marketplaceReviewSchema,
		makeMarketplaceReview(store),
	)

	registry.Register(
		"marketplace_reviews",
		"List reviews for a marketplace item ordered by most recent.",
		marketplaceReviewsSchema,
		makeMarketplaceReviews(store),
	)

	// Sharing
	registry.Register(
		"marketplace_share_team",
		"Share a private marketplace item with a specific team/organization.",
		marketplaceShareTeamSchema,
		makeMarketplaceShareTeam(store),
	)

	registry.Register(
		"marketplace_share_public",
		"Make a private or team-only marketplace item publicly visible.",
		marketplaceSharePublicSchema,
		makeMarketplaceSharePublic(store),
	)

	// Import / Export / Fork
	registry.Register(
		"marketplace_export",
		"Export a marketplace item as a portable JSON bundle that can be imported elsewhere.",
		marketplaceExportSchema,
		makeMarketplaceExport(store),
	)

	registry.Register(
		"marketplace_import",
		"Import a marketplace item from a JSON bundle produced by marketplace_export.",
		marketplaceImportSchema,
		makeMarketplaceImport(store),
	)

	registry.Register(
		"marketplace_fork",
		"Fork an existing marketplace item into your account as a new private draft, "+
			"preserving the original content and readme.",
		marketplaceForkSchema,
		makeMarketplaceFork(store),
	)
}

// ---------------------------------------------------------------------------
// CRUD handlers
// ---------------------------------------------------------------------------

func makeMarketplacePublish(store *marketplace.Store) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			Type        string   `json:"type"`
			Name        string   `json:"name"`
			Slug        string   `json:"slug"`
			Description string   `json:"description"`
			Category    string   `json:"category"`
			Tags        []string `json:"tags"`
			Content     string   `json:"content"`
			Readme      string   `json:"readme"`
			Pricing     string   `json:"pricing"`
			Visibility  string   `json:"visibility"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.Type == "" || input.Name == "" || input.Slug == "" {
			return mcp.ErrorResult("type, name, and slug are required"), nil
		}

		userCtx := auth.UserContextFromContext(ctx)
		if userCtx == nil {
			return mcp.ErrorResult("authentication required"), nil
		}

		var contentRaw json.RawMessage
		if input.Content != "" {
			contentRaw = json.RawMessage(input.Content)
		}

		item := marketplace.MarketplaceItem{
			OrganizationID: userCtx.OrgID,
			AuthorID:       userCtx.UserID,
			Type:           input.Type,
			Name:           input.Name,
			Slug:           input.Slug,
			Description:    input.Description,
			Category:       input.Category,
			Tags:           input.Tags,
			Content:        contentRaw,
			Readme:         input.Readme,
			Pricing:        input.Pricing,
			Visibility:     input.Visibility,
		}

		created, err := store.Publish(item)
		if err != nil {
			return mcp.ErrorResult("failed to publish: " + err.Error()), nil
		}

		return mdResult(MarkdownResponse{
			Frontmatter: map[string]interface{}{
				"id":     created.ID,
				"type":   created.Type,
				"status": created.Status,
				"export": "marketplace/published/" + created.Slug + ".md",
			},
			Body: fmt.Sprintf("# Published: %s\n\n"+
				"**ID:** `%s`\n**Type:** %s\n**Slug:** `%s`\n**Version:** %s\n**Visibility:** %s\n\n"+
				"%s",
				created.Name, created.ID, created.Type, created.Slug,
				created.Version, created.Visibility, created.Description),
			NextSteps: []NextStep{
				{Label: "View item", Command: fmt.Sprintf(`marketplace_get(id: "%s")`, created.ID)},
				{Label: "Install it", Command: fmt.Sprintf(`marketplace_install(item_id: "%s")`, created.ID)},
			},
		}), nil
	}
}

func makeMarketplaceUpdate(store *marketplace.Store) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			ID      string `json:"id"`
			Content string `json:"content"`
			Version string `json:"version"`
			Readme  string `json:"readme"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.ID == "" {
			return mcp.ErrorResult("id is required"), nil
		}

		if auth.UserContextFromContext(ctx) == nil {
			return mcp.ErrorResult("authentication required"), nil
		}

		updates := map[string]any{}
		if input.Content != "" {
			updates["content"] = json.RawMessage(input.Content)
		}
		if input.Version != "" {
			updates["version"] = input.Version
		}
		if input.Readme != "" {
			updates["readme"] = input.Readme
		}
		if len(updates) == 0 {
			return mcp.ErrorResult("no fields to update"), nil
		}

		if err := store.Update(input.ID, updates); err != nil {
			return mcp.ErrorResult("failed to update: " + err.Error()), nil
		}

		return mdResult(MarkdownResponse{
			Frontmatter: map[string]interface{}{
				"id":     input.ID,
				"type":   "marketplace_item",
				"status": "updated",
			},
			Body: fmt.Sprintf("# Item Updated\n\nItem `%s` has been updated successfully.\n\n**Changed fields:** %s",
				input.ID, strings.Join(mapKeys(updates), ", ")),
			NextSteps: []NextStep{
				{Label: "View updated item", Command: fmt.Sprintf(`marketplace_get(id: "%s")`, input.ID)},
			},
		}), nil
	}
}

func makeMarketplaceUnpublish(store *marketplace.Store) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.ID == "" {
			return mcp.ErrorResult("id is required"), nil
		}
		if auth.UserContextFromContext(ctx) == nil {
			return mcp.ErrorResult("authentication required"), nil
		}

		if err := store.Update(input.ID, map[string]any{"status": "archived"}); err != nil {
			return mcp.ErrorResult("failed to unpublish: " + err.Error()), nil
		}

		return mdResult(MarkdownResponse{
			Frontmatter: map[string]interface{}{
				"id":     input.ID,
				"type":   "marketplace_item",
				"status": "archived",
			},
			Body: fmt.Sprintf("# Item Unpublished\n\nItem `%s` has been archived and will no longer appear in listings.", input.ID),
		}), nil
	}
}

func makeMarketplaceGet(store *marketplace.Store) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.ID == "" {
			return mcp.ErrorResult("id is required"), nil
		}

		item, err := store.Get(input.ID)
		if err != nil {
			return mcp.ErrorResult("item not found: " + err.Error()), nil
		}

		stars := strings.Repeat("★", int(item.Rating)) + strings.Repeat("☆", 5-int(item.Rating))

		body := fmt.Sprintf("# %s\n\n"+
			"**ID:** `%s`  **Type:** %s  **Version:** %s\n"+
			"**Category:** %s  **Tags:** %s\n"+
			"**Rating:** %s (%.1f / %d reviews)  **Downloads:** %d\n"+
			"**Pricing:** %s  **Visibility:** %s  **Status:** %s\n\n"+
			"%s",
			item.Name,
			item.ID, item.Type, item.Version,
			item.Category, strings.Join(item.Tags, ", "),
			stars, item.Rating, item.RatingCount, item.Downloads,
			item.Pricing, item.Visibility, item.Status,
			item.Description,
		)

		if item.Readme != "" {
			body += "\n\n---\n\n" + item.Readme
		}

		return mdResult(MarkdownResponse{
			Frontmatter: map[string]interface{}{
				"id":     item.ID,
				"type":   item.Type,
				"status": item.Status,
			},
			Body: body,
			NextSteps: []NextStep{
				{Label: "Install", Command: fmt.Sprintf(`marketplace_install(item_id: "%s")`, item.ID)},
				{Label: "Reviews", Command: fmt.Sprintf(`marketplace_reviews(item_id: "%s")`, item.ID)},
			},
		}), nil
	}
}

func makeMarketplaceList(store *marketplace.Store) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			Type     string `json:"type"`
			Category string `json:"category"`
			Sort     string `json:"sort"`
			Limit    int    `json:"limit"`
		}
		if len(params) > 0 && string(params) != "null" {
			if err := json.Unmarshal(params, &input); err != nil {
				return mcp.ErrorResult("invalid params: " + err.Error()), nil
			}
		}

		items, err := store.List(marketplace.ListFilters{
			Type:     input.Type,
			Category: input.Category,
			Sort:     input.Sort,
			Limit:    input.Limit,
		})
		if err != nil {
			return mcp.ErrorResult("failed to list: " + err.Error()), nil
		}

		return mdResult(marketplaceItemsResponse("Marketplace Items", items,
			[]NextStep{
				{Label: "Search", Command: `marketplace_search(query: "...")`},
				{Label: "Install an item", Command: `marketplace_install(item_id: "...")`},
			},
		)), nil
	}
}

// ---------------------------------------------------------------------------
// Discovery handlers
// ---------------------------------------------------------------------------

func makeMarketplaceSearch(store *marketplace.Store) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			Query     string  `json:"query"`
			Type      string  `json:"type"`
			Category  string  `json:"category"`
			MinRating float64 `json:"min_rating"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.Query == "" {
			return mcp.ErrorResult("query is required"), nil
		}

		items, err := store.Search(input.Query, input.Type, input.Category)
		if err != nil {
			return mcp.ErrorResult("search failed: " + err.Error()), nil
		}

		// Client-side min_rating filter (DB search doesn't support it natively).
		if input.MinRating > 0 {
			filtered := items[:0]
			for _, item := range items {
				if item.Rating >= input.MinRating {
					filtered = append(filtered, item)
				}
			}
			items = filtered
		}

		return mdResult(marketplaceItemsResponse(
			fmt.Sprintf("Search: \"%s\" — %d result(s)", input.Query, len(items)),
			items,
			[]NextStep{
				{Label: "Install an item", Command: `marketplace_install(item_id: "...")`},
				{Label: "Get item details", Command: `marketplace_get(id: "...")`},
			},
		)), nil
	}
}

func makeMarketplaceFeatured(store *marketplace.Store) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			Type  string `json:"type"`
			Limit int    `json:"limit"`
		}
		if len(params) > 0 && string(params) != "null" {
			if err := json.Unmarshal(params, &input); err != nil {
				return mcp.ErrorResult("invalid params: " + err.Error()), nil
			}
		}

		items, err := store.Featured(input.Type, input.Limit)
		if err != nil {
			return mcp.ErrorResult("failed to get featured: " + err.Error()), nil
		}

		return mdResult(marketplaceItemsResponse("Featured Items", items,
			[]NextStep{
				{Label: "Install an item", Command: `marketplace_install(item_id: "...")`},
			},
		)), nil
	}
}

func makeMarketplaceTrending(store *marketplace.Store) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			Type   string `json:"type"`
			Period string `json:"period"`
			Limit  int    `json:"limit"`
		}
		if len(params) > 0 && string(params) != "null" {
			if err := json.Unmarshal(params, &input); err != nil {
				return mcp.ErrorResult("invalid params: " + err.Error()), nil
			}
		}
		if input.Period == "" {
			input.Period = "week"
		}

		items, err := store.Trending(input.Type, input.Period, input.Limit)
		if err != nil {
			return mcp.ErrorResult("failed to get trending: " + err.Error()), nil
		}

		return mdResult(marketplaceItemsResponse(
			fmt.Sprintf("Trending Items (%s)", input.Period),
			items,
			[]NextStep{
				{Label: "Install an item", Command: `marketplace_install(item_id: "...")`},
			},
		)), nil
	}
}

func makeMarketplaceByAuthor(store *marketplace.Store) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			AuthorID string `json:"author_id"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.AuthorID == "" {
			return mcp.ErrorResult("author_id is required"), nil
		}

		items, err := store.ByAuthor(input.AuthorID)
		if err != nil {
			return mcp.ErrorResult("failed to list by author: " + err.Error()), nil
		}

		return mdResult(marketplaceItemsResponse(
			fmt.Sprintf("Items by Author `%s`", input.AuthorID),
			items,
			[]NextStep{
				{Label: "Get item details", Command: `marketplace_get(id: "...")`},
			},
		)), nil
	}
}

// ---------------------------------------------------------------------------
// Install handlers
// ---------------------------------------------------------------------------

func makeMarketplaceInstall(store *marketplace.Store) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			ItemID string `json:"item_id"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.ItemID == "" {
			return mcp.ErrorResult("item_id is required"), nil
		}

		userCtx := auth.UserContextFromContext(ctx)
		if userCtx == nil {
			return mcp.ErrorResult("authentication required"), nil
		}

		// Fetch item to get its current version.
		item, err := store.Get(input.ItemID)
		if err != nil {
			return mcp.ErrorResult("item not found: " + err.Error()), nil
		}

		if err := store.Install(item.ID, userCtx.UserID, userCtx.OrgID, item.Version); err != nil {
			return mcp.ErrorResult("install failed: " + err.Error()), nil
		}

		return mdResult(MarkdownResponse{
			Frontmatter: map[string]interface{}{
				"id":     item.ID,
				"type":   item.Type,
				"status": "installed",
			},
			Body: fmt.Sprintf("# Installed: %s\n\n"+
				"**Type:** %s  **Version:** %s\n\n"+
				"%s\n\n"+
				"The item has been installed for your organization.",
				item.Name, item.Type, item.Version, item.Description),
			NextSteps: []NextStep{
				{Label: "View installed items", Command: `marketplace_installed()`},
				{Label: "Leave a review", Command: fmt.Sprintf(`marketplace_review(item_id: "%s", rating: 5)`, item.ID)},
			},
		}), nil
	}
}

func makeMarketplaceUninstall(store *marketplace.Store) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			ItemID string `json:"item_id"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.ItemID == "" {
			return mcp.ErrorResult("item_id is required"), nil
		}

		userCtx := auth.UserContextFromContext(ctx)
		if userCtx == nil {
			return mcp.ErrorResult("authentication required"), nil
		}

		if err := store.Uninstall(input.ItemID, userCtx.UserID, userCtx.OrgID); err != nil {
			return mcp.ErrorResult("uninstall failed: " + err.Error()), nil
		}

		return mdResult(MarkdownResponse{
			Frontmatter: map[string]interface{}{
				"id":     input.ItemID,
				"type":   "marketplace_item",
				"status": "uninstalled",
			},
			Body: fmt.Sprintf("# Item Uninstalled\n\nItem `%s` has been removed from your organization.", input.ItemID),
			NextSteps: []NextStep{
				{Label: "Browse marketplace", Command: `marketplace_list()`},
			},
		}), nil
	}
}

func makeMarketplaceInstalled(store *marketplace.Store) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			Type string `json:"type"`
		}
		if len(params) > 0 && string(params) != "null" {
			if err := json.Unmarshal(params, &input); err != nil {
				return mcp.ErrorResult("invalid params: " + err.Error()), nil
			}
		}

		userCtx := auth.UserContextFromContext(ctx)
		if userCtx == nil {
			return mcp.ErrorResult("authentication required"), nil
		}

		items, err := store.GetInstalled(userCtx.UserID, userCtx.OrgID, input.Type)
		if err != nil {
			return mcp.ErrorResult("failed to list installed: " + err.Error()), nil
		}

		return mdResult(marketplaceItemsResponse("Installed Items", items,
			[]NextStep{
				{Label: "Check for updates", Command: `marketplace_check_updates()`},
				{Label: "Uninstall", Command: `marketplace_uninstall(item_id: "...")`},
			},
		)), nil
	}
}

func makeMarketplaceCheckUpdates(store *marketplace.Store) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		userCtx := auth.UserContextFromContext(ctx)
		if userCtx == nil {
			return mcp.ErrorResult("authentication required"), nil
		}

		installed, err := store.GetInstalled(userCtx.UserID, userCtx.OrgID, "")
		if err != nil {
			return mcp.ErrorResult("failed to get installed items: " + err.Error()), nil
		}

		type updateAvailable struct {
			ID             string
			Name           string
			InstalledVer   string
			AvailableVer   string
		}

		var updates []updateAvailable
		for _, item := range installed {
			latest, err := store.Get(item.ID)
			if err != nil {
				continue
			}
			if latest.Version != item.Version && latest.Version != "" {
				updates = append(updates, updateAvailable{
					ID:           item.ID,
					Name:         item.Name,
					InstalledVer: item.Version,
					AvailableVer: latest.Version,
				})
			}
		}

		var body string
		if len(updates) == 0 {
			body = "# Up to Date\n\nAll installed items are at the latest version."
		} else {
			rows := make([][]string, len(updates))
			for i, u := range updates {
				rows[i] = []string{u.Name, u.InstalledVer, u.AvailableVer, "`" + u.ID + "`"}
			}
			body = fmt.Sprintf("# Updates Available (%d)\n\n", len(updates)) +
				mdTable([]string{"Name", "Installed", "Available", "ID"}, rows)
		}

		var nextSteps []NextStep
		for _, u := range updates {
			nextSteps = append(nextSteps, NextStep{
				Label:   "Update " + u.Name,
				Command: fmt.Sprintf(`marketplace_install(item_id: "%s")`, u.ID),
			})
		}

		return mdResult(MarkdownResponse{
			Frontmatter: map[string]interface{}{
				"type":   "update_check",
				"status": fmt.Sprintf("%d updates available", len(updates)),
			},
			Body:      body,
			NextSteps: nextSteps,
		}), nil
	}
}

// ---------------------------------------------------------------------------
// Review handlers
// ---------------------------------------------------------------------------

func makeMarketplaceReview(store *marketplace.Store) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			ItemID string `json:"item_id"`
			Rating int    `json:"rating"`
			Review string `json:"review"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.ItemID == "" {
			return mcp.ErrorResult("item_id is required"), nil
		}
		if input.Rating < 1 || input.Rating > 5 {
			return mcp.ErrorResult("rating must be between 1 and 5"), nil
		}

		userCtx := auth.UserContextFromContext(ctx)
		if userCtx == nil {
			return mcp.ErrorResult("authentication required"), nil
		}

		if err := store.AddReview(input.ItemID, userCtx.UserID, input.Rating, input.Review); err != nil {
			return mcp.ErrorResult("failed to submit review: " + err.Error()), nil
		}

		stars := strings.Repeat("★", input.Rating) + strings.Repeat("☆", 5-input.Rating)

		return mdResult(MarkdownResponse{
			Frontmatter: map[string]interface{}{
				"type":   "review",
				"status": "submitted",
			},
			Body: fmt.Sprintf("# Review Submitted\n\n"+
				"**Item:** `%s`\n**Rating:** %s (%d/5)\n\n%s",
				input.ItemID, stars, input.Rating, input.Review),
			NextSteps: []NextStep{
				{Label: "View all reviews", Command: fmt.Sprintf(`marketplace_reviews(item_id: "%s")`, input.ItemID)},
			},
		}), nil
	}
}

func makeMarketplaceReviews(store *marketplace.Store) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			ItemID string `json:"item_id"`
			Limit  int    `json:"limit"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.ItemID == "" {
			return mcp.ErrorResult("item_id is required"), nil
		}

		reviews, err := store.GetReviews(input.ItemID, input.Limit)
		if err != nil {
			return mcp.ErrorResult("failed to get reviews: " + err.Error()), nil
		}

		rows := make([][]string, len(reviews))
		for i, r := range reviews {
			stars := strings.Repeat("★", r.Rating) + strings.Repeat("☆", 5-r.Rating)
			rows[i] = []string{stars, truncate(r.Review, 80), r.UserID, r.CreatedAt}
		}

		body := fmt.Sprintf("# Reviews for `%s` (%d)\n\n", input.ItemID, len(reviews))
		if len(reviews) > 0 {
			body += mdTable([]string{"Rating", "Review", "User", "Date"}, rows)
		} else {
			body += "_No reviews yet._"
		}

		return mdResult(MarkdownResponse{
			Frontmatter: map[string]interface{}{
				"type":   "reviews",
				"status": fmt.Sprintf("%d reviews", len(reviews)),
			},
			Body: body,
			NextSteps: []NextStep{
				{Label: "Submit a review", Command: fmt.Sprintf(`marketplace_review(item_id: "%s", rating: 5)`, input.ItemID)},
			},
		}), nil
	}
}

// ---------------------------------------------------------------------------
// Sharing handlers
// ---------------------------------------------------------------------------

func makeMarketplaceShareTeam(store *marketplace.Store) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			ItemID string `json:"item_id"`
			TeamID string `json:"team_id"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.ItemID == "" || input.TeamID == "" {
			return mcp.ErrorResult("item_id and team_id are required"), nil
		}
		if auth.UserContextFromContext(ctx) == nil {
			return mcp.ErrorResult("authentication required"), nil
		}

		if err := store.Update(input.ItemID, map[string]any{
			"visibility":   "team",
			"shared_org_id": input.TeamID,
		}); err != nil {
			return mcp.ErrorResult("failed to share with team: " + err.Error()), nil
		}

		return mdResult(MarkdownResponse{
			Frontmatter: map[string]interface{}{
				"id":     input.ItemID,
				"type":   "marketplace_item",
				"status": "shared",
			},
			Body: fmt.Sprintf("# Shared with Team\n\nItem `%s` is now visible to team `%s`.",
				input.ItemID, input.TeamID),
		}), nil
	}
}

func makeMarketplaceSharePublic(store *marketplace.Store) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			ItemID string `json:"item_id"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.ItemID == "" {
			return mcp.ErrorResult("item_id is required"), nil
		}
		if auth.UserContextFromContext(ctx) == nil {
			return mcp.ErrorResult("authentication required"), nil
		}

		if err := store.Update(input.ItemID, map[string]any{"visibility": "public"}); err != nil {
			return mcp.ErrorResult("failed to make public: " + err.Error()), nil
		}

		return mdResult(MarkdownResponse{
			Frontmatter: map[string]interface{}{
				"id":     input.ItemID,
				"type":   "marketplace_item",
				"status": "public",
			},
			Body: fmt.Sprintf("# Now Public\n\nItem `%s` is now publicly visible in the marketplace.", input.ItemID),
			NextSteps: []NextStep{
				{Label: "View item", Command: fmt.Sprintf(`marketplace_get(id: "%s")`, input.ItemID)},
			},
		}), nil
	}
}

// ---------------------------------------------------------------------------
// Import / Export / Fork handlers
// ---------------------------------------------------------------------------

func makeMarketplaceExport(store *marketplace.Store) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			ItemID string `json:"item_id"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.ItemID == "" {
			return mcp.ErrorResult("item_id is required"), nil
		}

		item, err := store.Get(input.ItemID)
		if err != nil {
			return mcp.ErrorResult("item not found: " + err.Error()), nil
		}

		// Export strips org/author IDs to create a portable bundle.
		export := map[string]interface{}{
			"schema_version": "1.0",
			"exported_at":    time.Now().UTC().Format(time.RFC3339),
			"type":           item.Type,
			"name":           item.Name,
			"slug":           item.Slug,
			"description":    item.Description,
			"category":       item.Category,
			"tags":           item.Tags,
			"version":        item.Version,
			"content":        item.Content,
			"readme":         item.Readme,
			"pricing":        item.Pricing,
		}

		data, err := json.MarshalIndent(export, "", "  ")
		if err != nil {
			return mcp.ErrorResult("marshal export: " + err.Error()), nil
		}

		return mdResult(MarkdownResponse{
			Frontmatter: map[string]interface{}{
				"id":     item.ID,
				"type":   "export",
				"export": "marketplace/exports/" + item.Slug + ".json",
			},
			Body: fmt.Sprintf("# Export: %s\n\n```json\n%s\n```", item.Name, string(data)),
			NextSteps: []NextStep{
				{Label: "Import elsewhere", Command: fmt.Sprintf(`marketplace_import(content: '...')`)},
			},
		}), nil
	}
}

func makeMarketplaceImport(store *marketplace.Store) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			Content string `json:"content"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.Content == "" {
			return mcp.ErrorResult("content is required"), nil
		}

		userCtx := auth.UserContextFromContext(ctx)
		if userCtx == nil {
			return mcp.ErrorResult("authentication required"), nil
		}

		var bundle struct {
			Type        string          `json:"type"`
			Name        string          `json:"name"`
			Slug        string          `json:"slug"`
			Description string          `json:"description"`
			Category    string          `json:"category"`
			Tags        []string        `json:"tags"`
			Version     string          `json:"version"`
			Content     json.RawMessage `json:"content"`
			Readme      string          `json:"readme"`
			Pricing     string          `json:"pricing"`
		}
		if err := json.Unmarshal([]byte(input.Content), &bundle); err != nil {
			return mcp.ErrorResult("invalid export bundle: " + err.Error()), nil
		}
		if bundle.Type == "" || bundle.Name == "" {
			return mcp.ErrorResult("bundle missing required fields: type, name"), nil
		}

		item := marketplace.MarketplaceItem{
			OrganizationID: userCtx.OrgID,
			AuthorID:       userCtx.UserID,
			Type:           bundle.Type,
			Name:           bundle.Name,
			Slug:           bundle.Slug,
			Description:    bundle.Description,
			Category:       bundle.Category,
			Tags:           bundle.Tags,
			Version:        bundle.Version,
			Content:        bundle.Content,
			Readme:         bundle.Readme,
			Pricing:        bundle.Pricing,
			Visibility:     "private",
			Status:         "draft",
		}

		created, err := store.Publish(item)
		if err != nil {
			return mcp.ErrorResult("import failed: " + err.Error()), nil
		}

		return mdResult(MarkdownResponse{
			Frontmatter: map[string]interface{}{
				"id":     created.ID,
				"type":   created.Type,
				"status": "imported",
			},
			Body: fmt.Sprintf("# Imported: %s\n\n"+
				"Successfully imported as a private draft.\n\n"+
				"**ID:** `%s`  **Type:** %s  **Version:** %s",
				created.Name, created.ID, created.Type, created.Version),
			NextSteps: []NextStep{
				{Label: "Publish it", Command: fmt.Sprintf(`marketplace_share_public(item_id: "%s")`, created.ID)},
				{Label: "View item", Command: fmt.Sprintf(`marketplace_get(id: "%s")`, created.ID)},
			},
		}), nil
	}
}

func makeMarketplaceFork(store *marketplace.Store) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			ItemID string `json:"item_id"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.ItemID == "" {
			return mcp.ErrorResult("item_id is required"), nil
		}

		userCtx := auth.UserContextFromContext(ctx)
		if userCtx == nil {
			return mcp.ErrorResult("authentication required"), nil
		}

		original, err := store.Get(input.ItemID)
		if err != nil {
			return mcp.ErrorResult("item not found: " + err.Error()), nil
		}

		// Fork: copy with new slug suffix, set as private draft owned by current user.
		fork := marketplace.MarketplaceItem{
			OrganizationID: userCtx.OrgID,
			AuthorID:       userCtx.UserID,
			Type:           original.Type,
			Name:           original.Name + " (fork)",
			Slug:           original.Slug + "-fork-" + time.Now().Format("20060102"),
			Description:    original.Description,
			Category:       original.Category,
			Tags:           original.Tags,
			Version:        original.Version,
			Content:        original.Content,
			Readme:         original.Readme,
			Pricing:        "free",
			Visibility:     "private",
			Status:         "draft",
		}

		created, err := store.Publish(fork)
		if err != nil {
			return mcp.ErrorResult("fork failed: " + err.Error()), nil
		}

		return mdResult(MarkdownResponse{
			Frontmatter: map[string]interface{}{
				"id":     created.ID,
				"type":   created.Type,
				"status": "forked",
			},
			Body: fmt.Sprintf("# Forked: %s\n\n"+
				"A private copy of `%s` has been created.\n\n"+
				"**Fork ID:** `%s`  **Slug:** `%s`\n\n"+
				"Edit and publish when ready.",
				created.Name, original.Name, created.ID, created.Slug),
			NextSteps: []NextStep{
				{Label: "Edit content", Command: fmt.Sprintf(`marketplace_update(id: "%s", content: "...")`, created.ID)},
				{Label: "Publish fork", Command: fmt.Sprintf(`marketplace_share_public(item_id: "%s")`, created.ID)},
			},
		}), nil
	}
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

// marketplaceItemsResponse builds a standardised markdown list response.
func marketplaceItemsResponse(title string, items []marketplace.MarketplaceItem, nextSteps []NextStep) MarkdownResponse {
	var body string
	if len(items) == 0 {
		body = fmt.Sprintf("# %s\n\n_No items found._", title)
	} else {
		rows := make([][]string, len(items))
		for i, item := range items {
			tags := strings.Join(item.Tags, ", ")
			if len(tags) > 40 {
				tags = tags[:37] + "..."
			}
			rating := fmt.Sprintf("%.1f (%d)", item.Rating, item.RatingCount)
			rows[i] = []string{
				item.Name,
				item.Type,
				item.Version,
				tags,
				rating,
				fmt.Sprintf("%d", item.Downloads),
				"`" + item.ID + "`",
			}
		}
		body = fmt.Sprintf("# %s (%d)\n\n", title, len(items)) +
			mdTable([]string{"Name", "Type", "Version", "Tags", "Rating", "Downloads", "ID"}, rows)
	}

	return MarkdownResponse{
		Frontmatter: map[string]interface{}{
			"type":  "marketplace_list",
			"count": len(items),
		},
		Body:      body,
		NextSteps: nextSteps,
	}
}

// mapKeys returns the keys of a map as a sorted slice.
func mapKeys(m map[string]any) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}
