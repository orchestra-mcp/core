import { useState, type FC, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import SmartActionsGrid, { type EntityType } from "./SmartActionsGrid";

interface SmartActionsDialogProps {
  open: boolean;
  onClose: () => void;
}

const SmartActionsDialog: FC<SmartActionsDialogProps> = ({ open, onClose }) => {
  const [selected, setSelected] = useState<EntityType | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSelected(null);
      setTitle("");
      setContent("");
      setError(null);
      setCreating(false);
    }
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selected) {
          setSelected(null);
          setTitle("");
          setContent("");
          setError(null);
        } else {
          onClose();
        }
      }
    };
    if (open) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, selected, onClose]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  };

  const handleCreate = async () => {
    if (!selected || !title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await invoke("create_entity", {
        entityType: selected.id,
        title: title.trim(),
        content: content.trim(),
      });
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
      style={{ background: "hsla(0, 0%, 0%, 0.6)" }}
    >
      <div
        className="w-full max-w-xl rounded-lg shadow-2xl"
        style={{
          background: "var(--background-dialog)",
          border: "1px solid var(--border-overlay)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid var(--border-default)" }}
        >
          <div className="flex items-center gap-3">
            {selected && (
              <button
                onClick={() => {
                  setSelected(null);
                  setTitle("");
                  setContent("");
                  setError(null);
                }}
                className="rounded-md p-1 transition-colors"
                style={{ color: "var(--foreground-lighter)" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--background-surface-300)";
                  e.currentTarget.style.color = "var(--foreground-default)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--foreground-lighter)";
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10 12L6 8L10 4" />
                </svg>
              </button>
            )}
            <h2 className="text-base font-semibold" style={{ color: "var(--foreground-default)" }}>
              {selected
                ? `Create ${selected.label}`
                : "Smart Actions"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 transition-colors"
            style={{ color: "var(--foreground-lighter)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--background-surface-300)";
              e.currentTarget.style.color = "var(--foreground-default)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--foreground-lighter)";
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 4L12 12M12 4L4 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {!selected ? (
            <>
              <p className="mb-4 text-sm" style={{ color: "var(--foreground-lighter)" }}>
                Select an entity type to create
              </p>
              <SmartActionsGrid onSelect={setSelected} />
            </>
          ) : (
            <div className="space-y-4">
              {/* Entity badge */}
              <div className="flex items-center gap-2">
                <span className="text-lg">{selected.icon}</span>
                <span className="text-sm font-medium" style={{ color: "var(--foreground-light)" }}>
                  {selected.label}
                </span>
              </div>

              {/* Title */}
              <div>
                <label
                  className="mb-1.5 block text-xs font-medium"
                  style={{ color: "var(--foreground-lighter)" }}
                >
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && title.trim()) handleCreate();
                  }}
                  placeholder={`Enter ${selected.label.toLowerCase()} title...`}
                  autoFocus
                  className="w-full rounded-md px-3 py-2 text-sm outline-none transition"
                  style={{
                    background: "var(--background-control)",
                    border: "1px solid var(--border-control)",
                    color: "var(--foreground-default)",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "var(--brand-default)";
                    e.currentTarget.style.boxShadow = "0 0 0 1px hsla(153.1, 60.2%, 52.7%, 0.3)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-control)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>

              {/* Content */}
              <div>
                <label
                  className="mb-1.5 block text-xs font-medium"
                  style={{ color: "var(--foreground-lighter)" }}
                >
                  Content{" "}
                  <span style={{ color: "var(--foreground-muted)" }}>(markdown supported)</span>
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write your content here..."
                  rows={6}
                  className="w-full resize-none rounded-md px-3 py-2 text-sm outline-none transition"
                  style={{
                    background: "var(--background-control)",
                    border: "1px solid var(--border-control)",
                    color: "var(--foreground-default)",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "var(--brand-default)";
                    e.currentTarget.style.boxShadow = "0 0 0 1px hsla(153.1, 60.2%, 52.7%, 0.3)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-control)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>

              {/* Error */}
              {error && (
                <p
                  className="rounded-md px-3 py-2 text-xs"
                  style={{
                    background: "var(--destructive-200)",
                    border: "1px solid hsla(10.2, 77.9%, 53.9%, 0.2)",
                    color: "var(--destructive-600)",
                  }}
                >
                  {error}
                </p>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    setSelected(null);
                    setTitle("");
                    setContent("");
                    setError(null);
                  }}
                  className="rounded-md px-4 py-2 text-sm font-medium transition-colors"
                  style={{
                    border: "1px solid var(--border-strong)",
                    color: "var(--foreground-light)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--background-surface-300)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!title.trim() || creating}
                  className="rounded-md px-4 py-2 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    background: "var(--brand-default)",
                    color: "var(--foreground-contrast)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--brand-600)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "var(--brand-default)";
                  }}
                >
                  {creating ? "Creating..." : "Create"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SmartActionsDialog;
