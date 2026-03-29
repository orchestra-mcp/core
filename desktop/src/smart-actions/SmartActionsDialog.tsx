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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl shadow-black/40">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div className="flex items-center gap-3">
            {selected && (
              <button
                onClick={() => {
                  setSelected(null);
                  setTitle("");
                  setContent("");
                  setError(null);
                }}
                className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
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
            <h2 className="text-base font-semibold text-zinc-100">
              {selected
                ? `Create ${selected.label}`
                : "Smart Actions"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
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
              <p className="mb-4 text-sm text-zinc-500">
                Select an entity type to create
              </p>
              <SmartActionsGrid onSelect={setSelected} />
            </>
          ) : (
            <div className="space-y-4">
              {/* Entity badge */}
              <div className="flex items-center gap-2">
                <span className="text-lg">{selected.icon}</span>
                <span className="text-sm font-medium text-zinc-300">
                  {selected.label}
                </span>
              </div>

              {/* Title */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">
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
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
                />
              </div>

              {/* Content */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                  Content{" "}
                  <span className="text-zinc-600">(markdown supported)</span>
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write your content here..."
                  rows={6}
                  className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
                />
              </div>

              {/* Error */}
              {error && (
                <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
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
                  className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!title.trim() || creating}
                  className="rounded-lg bg-gradient-to-r from-violet-600 to-violet-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-violet-500/20 transition-all hover:from-violet-500 hover:to-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
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
