package logging

import (
	"context"
	"database/sql"
	"encoding/json"
	"log/slog"
	"time"

	_ "github.com/lib/pq"
)

// DBLogger writes structured log entries to the service_logs PostgreSQL table
// using a buffered background worker to avoid blocking callers.
type DBLogger struct {
	db      *sql.DB
	service string
	ch      chan logEntry
	done    chan struct{}
}

type logEntry struct {
	Level     string
	Message   string
	Context   map[string]interface{}
	RequestID string
	UserID    string
	CreatedAt time.Time
}

// Log level constants matching the Orchestra Logs page expectations.
const (
	LevelInfo  = "info"
	LevelWarn  = "warn"
	LevelError = "error"
	LevelDebug = "debug"
)

// NewDBLogger opens a connection to PostgreSQL and starts a background worker
// that drains log entries into the service_logs table.
func NewDBLogger(dbURL string, service string) (*DBLogger, error) {
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		return nil, err
	}

	if err := db.Ping(); err != nil {
		db.Close()
		return nil, err
	}

	logger := &DBLogger{
		db:      db,
		service: service,
		ch:      make(chan logEntry, 1000),
		done:    make(chan struct{}),
	}
	go logger.worker()
	return logger, nil
}

// Log enqueues a structured log entry for asynchronous writing. If the channel
// is full the entry is silently dropped to avoid back-pressure on callers.
func (l *DBLogger) Log(level, message string, ctx map[string]interface{}, requestID, userID string) {
	select {
	case l.ch <- logEntry{
		Level:     level,
		Message:   message,
		Context:   ctx,
		RequestID: requestID,
		UserID:    userID,
		CreatedAt: time.Now(),
	}:
	default:
		// Channel full — drop log to avoid blocking the caller.
		slog.Warn("dblogger: channel full, dropping log entry", "message", message)
	}
}

// Info is a convenience method for INFO-level logs.
func (l *DBLogger) Info(message string, ctx map[string]interface{}, requestID, userID string) {
	l.Log(LevelInfo, message, ctx, requestID, userID)
}

// Warn is a convenience method for WARN-level logs.
func (l *DBLogger) Warn(message string, ctx map[string]interface{}, requestID, userID string) {
	l.Log(LevelWarn, message, ctx, requestID, userID)
}

// Error is a convenience method for ERROR-level logs.
func (l *DBLogger) Error(message string, ctx map[string]interface{}, requestID, userID string) {
	l.Log(LevelError, message, ctx, requestID, userID)
}

// worker drains the log channel and writes each entry to PostgreSQL.
func (l *DBLogger) worker() {
	defer close(l.done)
	for entry := range l.ch {
		ctxJSON, err := json.Marshal(entry.Context)
		if err != nil {
			ctxJSON = []byte("{}")
		}

		_, execErr := l.db.ExecContext(context.Background(),
			`INSERT INTO public.service_logs (service, level, message, context, request_id, user_id, created_at)
			 VALUES ($1, $2, $3, $4, $5, NULLIF($6, '')::uuid, $7)`,
			l.service, entry.Level, entry.Message, ctxJSON,
			entry.RequestID, entry.UserID, entry.CreatedAt,
		)
		if execErr != nil {
			slog.Error("dblogger: failed to insert log entry", "error", execErr, "message", entry.Message)
		}
	}
}

// Close shuts down the logger by closing the channel and waiting for the
// background worker to drain remaining entries before closing the DB connection.
func (l *DBLogger) Close() {
	close(l.ch)
	<-l.done // Wait for worker to finish draining.
	l.db.Close()
}
