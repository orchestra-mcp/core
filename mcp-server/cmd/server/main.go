package main

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/orchestra-mcp/server/internal/auth"
	"github.com/orchestra-mcp/server/internal/db"
	"github.com/orchestra-mcp/server/internal/embedding"
	"github.com/orchestra-mcp/server/internal/logging"
	"github.com/orchestra-mcp/server/internal/mcp"
	"github.com/orchestra-mcp/server/internal/notifications"
	"github.com/orchestra-mcp/server/internal/realtime"
	"github.com/orchestra-mcp/server/internal/tools"
)

const (
	defaultPort = "3001"
	version     = "0.1.0"
	serviceName = "orchestra-mcp"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	port := os.Getenv("PORT")
	if port == "" {
		port = defaultPort
	}

	// --- Initialize DB client (Supabase REST) ---
	supabaseURL := os.Getenv("SUPABASE_URL")
	supabaseKey := os.Getenv("SUPABASE_SERVICE_KEY")

	var dbClient *db.Client
	if supabaseURL != "" && supabaseKey != "" {
		dbClient = db.NewClient(supabaseURL, supabaseKey)
		slog.Info("supabase client initialized", "url", supabaseURL)
	} else {
		slog.Warn("SUPABASE_URL or SUPABASE_SERVICE_KEY not set — DB client disabled")
	}

	// --- Initialize embedding client ---
	embProvider := os.Getenv("EMBEDDING_PROVIDER")
	embAPIKey := os.Getenv("EMBEDDING_API_KEY")
	embModel := os.Getenv("EMBEDDING_MODEL")

	var embClient *embedding.Client
	if embAPIKey != "" {
		if embProvider == "" {
			embProvider = "openai"
		}
		if embModel == "" {
			embModel = "text-embedding-3-small"
		}
		embClient = embedding.NewClient(embProvider, embAPIKey, embModel)
		slog.Info("embedding client initialized", "provider", embProvider, "model", embModel)
	} else {
		slog.Warn("EMBEDDING_API_KEY not set — embedding client disabled")
	}

	// --- Initialize auth middleware ---
	databaseURL := os.Getenv("DATABASE_URL")

	var authMiddleware *auth.TokenMiddleware
	if databaseURL != "" {
		var err error
		authMiddleware, err = auth.NewTokenMiddleware(databaseURL)
		if err != nil {
			slog.Error("failed to initialize auth middleware", "error", err)
			os.Exit(1)
		}
		defer authMiddleware.Close()
		slog.Info("auth middleware initialized")
	} else {
		slog.Warn("DATABASE_URL not set — auth middleware disabled (all requests allowed)")
	}

	// --- Initialize DB logger ---
	var dbLogger *logging.DBLogger
	if databaseURL != "" {
		var err error
		dbLogger, err = logging.NewDBLogger(databaseURL, "go_mcp")
		if err != nil {
			slog.Error("failed to initialize DB logger", "error", err)
			// Non-fatal: continue without DB logging.
		} else {
			defer dbLogger.Close()
			slog.Info("DB logger initialized", "service", "go_mcp")
		}
	} else {
		slog.Warn("DATABASE_URL not set — DB logger disabled")
	}

	// --- Initialize rate limiter ---
	rateLimiter := auth.NewRateLimiter()
	slog.Info("rate limiter initialized")

	// --- Initialize realtime hub ---
	hub := realtime.NewHub()
	_ = hub // available for tool handlers to broadcast changes
	slog.Info("realtime hub initialized")

	// --- Initialize notification router (Slack, Discord, Telegram) ---
	notifyRouter := notifications.NewRouter()
	if notifyRouter.Slack.Enabled() {
		slog.Info("slack client initialized")
	} else {
		slog.Warn("SLACK_BOT_TOKEN not set — Slack notifications disabled")
	}
	if notifyRouter.Discord.Enabled() {
		slog.Info("discord client initialized")
	} else {
		slog.Warn("DISCORD_WEBHOOK_URL/DISCORD_BOT_TOKEN not set — Discord notifications disabled")
	}
	if notifyRouter.Telegram.Enabled() {
		slog.Info("telegram client initialized")
	} else {
		slog.Warn("TELEGRAM_BOT_TOKEN not set — Telegram notifications disabled")
	}

	// --- Build tool registry ---
	registry := mcp.NewToolRegistry()

	// Register a built-in echo tool for testing connectivity.
	registry.Register("echo", "Echo back the input text (for testing)", json.RawMessage(`{
		"type": "object",
		"properties": {
			"text": {"type": "string", "description": "Text to echo back"}
		},
		"required": ["text"]
	}`), func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			Text string `json:"text"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return nil, err
		}
		return &mcp.ToolResult{
			Content: []mcp.ContentBlock{{Type: "text", Text: input.Text}},
		}, nil
	})

	// Register tool groups — ALL DB-dependent tools register when dbClient is available.
	if dbClient != nil {
		tools.RegisterProjectTools(registry, dbClient)
		slog.Info("registered project tools")

		tools.RegisterAgentTools(registry, dbClient)
		slog.Info("registered agent tools")

		tools.RegisterTaskTools(registry, dbClient)
		slog.Info("registered task tools")

		tools.RegisterSessionTools(registry, dbClient)
		slog.Info("registered session tools")

		tools.RegisterNoteTools(registry, dbClient)
		slog.Info("registered note tools")

		tools.RegisterSpecTools(registry, dbClient)
		slog.Info("registered spec tools")

		tools.RegisterSkillTools(registry, dbClient)
		slog.Info("registered skill tools")

		tools.RegisterWorkflowTools(registry, dbClient)
		slog.Info("registered workflow tools")

		tools.RegisterGateTools(registry, dbClient)
		slog.Info("registered gate tools")

		tools.RegisterEvidenceTools(registry, dbClient)
		slog.Info("registered evidence tools")

		tools.RegisterTransitionTools(registry, dbClient)
		slog.Info("registered transition tools")

		tools.RegisterActivityTools(registry, dbClient)
		slog.Info("registered activity tools")

		tools.RegisterGitHubTools(registry, dbClient)
		slog.Info("registered GitHub tools")

		tools.RegisterUsageTools(registry, dbClient)
		slog.Info("registered usage tools")

		tools.RegisterExportTools(registry, dbClient)
		slog.Info("registered export tools")

		tools.RegisterDiagramExportTools(registry, dbClient)
		slog.Info("registered diagram export tools")

		tools.RegisterOfficeExportTools(registry, dbClient)
		slog.Info("registered office export tools (docx, pptx)")

		tools.RegisterReportTools(registry, dbClient)
		slog.Info("registered report tools")

		// Memory and decision tools accept an optional embedding client.
		// They degrade gracefully (no semantic search) when embClient is nil.
		tools.RegisterMemoryTools(registry, dbClient, embClient)
		slog.Info("registered memory tools")

		tools.RegisterDecisionTools(registry, dbClient, embClient)
		slog.Info("registered decision tools")
	}

	// Keep slack_notify for backwards compatibility.
	tools.RegisterSlackTools(registry, notifyRouter.Slack)
	slog.Info("registered Slack tools")

	// Register unified notify + per-provider tools (discord_notify, telegram_notify).
	tools.RegisterNotifyTools(registry, notifyRouter)
	slog.Info("registered notification tools (notify, discord_notify, telegram_notify)")

	// --- Create MCP server (with DB client for audit logging) ---
	server := mcp.NewServer(registry, dbLogger, dbClient)

	// --- Setup routes ---
	mux := http.NewServeMux()

	// Health check — no auth required.
	mux.HandleFunc("GET /mcp/health", handleHealth)

	// MCP unified endpoint — handles GET (SSE streams), POST (JSON-RPC), and
	// DELETE (session termination) for both the new Streamable HTTP transport
	// (2025-11-25) and the legacy SSE transport (2024-11-05).
	if authMiddleware != nil {
		mcpHandler := authMiddleware.Middleware(rateLimiter.Middleware(http.HandlerFunc(server.HandleMCP)))
		mux.Handle("/mcp", authFailureLogger(mcpHandler, dbLogger))
	} else {
		mux.HandleFunc("/mcp", server.HandleMCP)
	}

	// WebSocket endpoint (placeholder).
	mux.HandleFunc("/mcp/ws", server.HandleWebSocket)

	// Catch-all: return JSON 404 instead of plain text (Claude Code expects JSON)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "not found", "path": r.URL.Path})
	})

	handler := corsMiddleware(mux)

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           handler,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      0, // SSE connections are long-lived; no write timeout.
		IdleTimeout:       60 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
	}

	// Graceful shutdown.
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer stop()

	go func() {
		slog.Info("starting server", "port", port, "version", version, "service", serviceName)
		if dbLogger != nil {
			dbLogger.Info("MCP server started", map[string]interface{}{
				"port":    port,
				"version": version,
			}, "", "")
		}
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server failed", "error", err)
			if dbLogger != nil {
				dbLogger.Error("MCP server failed", map[string]interface{}{
					"error": err.Error(),
				}, "", "")
			}
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	slog.Info("shutting down server")
	if dbLogger != nil {
		dbLogger.Info("MCP server shutting down", nil, "", "")
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("shutdown failed", "error", err)
		os.Exit(1)
	}

	slog.Info("server stopped gracefully")
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "ok",
		"version": version,
		"service": serviceName,
	})
}

// authFailureLogger is an HTTP middleware that detects 401 responses from the
// auth middleware and logs them to the DB logger.
func authFailureLogger(inner http.Handler, dbLogger *logging.DBLogger) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		inner.ServeHTTP(rec, r)
		if rec.status == http.StatusUnauthorized && dbLogger != nil {
			dbLogger.Warn("Authentication failed", map[string]interface{}{
				"remote": r.RemoteAddr,
				"path":   r.URL.Path,
				"method": r.Method,
			}, "", "")
		}
	})
}

// statusRecorder wraps http.ResponseWriter to capture the status code.
// It also implements http.Flusher so SSE streaming works through the wrapper.
type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

// Flush implements http.Flusher, forwarding to the underlying writer.
// This is critical for SSE connections that need to flush each event.
func (r *statusRecorder) Flush() {
	if f, ok := r.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

// Unwrap returns the underlying ResponseWriter so interface type assertions
// (e.g., http.Flusher) can reach through the wrapper chain.
func (r *statusRecorder) Unwrap() http.ResponseWriter {
	return r.ResponseWriter
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version")
		w.Header().Set("Access-Control-Expose-Headers", "Mcp-Session-Id")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
