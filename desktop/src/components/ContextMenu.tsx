/**
 * Custom dark-themed context menu component for Orchestra Desktop.
 * Appears at cursor position, auto-closes on outside click / Escape,
 * flips when near screen edges.
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContextMenuItem {
  /** Unique key. */
  id: string;
  /** Display label. */
  label: string;
  /** Optional icon (JSX). */
  icon?: ReactNode;
  /** Action handler. */
  onClick: () => void;
  /** If true, renders a separator line BEFORE this item. */
  separator?: boolean;
  /** If true, item is disabled / grayed out. */
  disabled?: boolean;
}

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export interface ContextMenuProps {
  items: ContextMenuItem[];
  position: ContextMenuPosition | null;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Icons (inline SVG helpers)
// ---------------------------------------------------------------------------

export function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M10.5 5.5V3a1.5 1.5 0 0 0-1.5-1.5H3A1.5 1.5 0 0 0 1.5 3v6A1.5 1.5 0 0 0 3 10.5h2.5" />
    </svg>
  );
}

export function ImageIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="1.5" width="13" height="13" rx="2" />
      <circle cx="5.5" cy="5.5" r="1.25" />
      <path d="m14.5 10-3-3L3.5 14.5" />
    </svg>
  );
}

export function FileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 1.5H4A1.5 1.5 0 0 0 2.5 3v10A1.5 1.5 0 0 0 4 14.5h8a1.5 1.5 0 0 0 1.5-1.5V6.5L9 1.5Z" />
      <path d="M9 1.5V5a1.5 1.5 0 0 0 1.5 1.5H13.5" />
    </svg>
  );
}

export function TableIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="1.5" width="13" height="13" rx="2" />
      <line x1="1.5" y1="6" x2="14.5" y2="6" />
      <line x1="1.5" y1="10.5" x2="14.5" y2="10.5" />
      <line x1="6" y1="1.5" x2="6" y2="14.5" />
    </svg>
  );
}

export function MarkdownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="0.5" y="3" width="15" height="10" rx="1.5" />
      <path d="M3 10V6l2 2.5L7 6v4" />
      <path d="M11.5 8.5 13 10l1.5-1.5" />
      <line x1="13" y1="6" x2="13" y2="10" />
    </svg>
  );
}

export function TextIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="3" x2="13" y2="3" />
      <line x1="8" y1="3" x2="8" y2="13" />
      <line x1="5.5" y1="13" x2="10.5" y2="13" />
    </svg>
  );
}

export function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5v9" />
      <path d="m4.5 7 3.5 3.5L11.5 7" />
      <path d="M2.5 12.5v1h11v-1" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// ContextMenu component
// ---------------------------------------------------------------------------

export default function ContextMenu({ items, position, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjusted, setAdjusted] = useState<{ x: number; y: number } | null>(null);

  // Close on Escape
  useEffect(() => {
    if (!position) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [position, onClose]);

  // Close on outside click
  useEffect(() => {
    if (!position) return;

    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Use capture so we get it before anything else
    window.addEventListener("mousedown", handleClick, true);
    return () => window.removeEventListener("mousedown", handleClick, true);
  }, [position, onClose]);

  // Position-aware flip
  useEffect(() => {
    if (!position || !menuRef.current) {
      setAdjusted(null);
      return;
    }
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let x = position.x;
    let y = position.y;

    // Flip horizontally if menu would overflow right edge
    if (x + rect.width > vw - 8) {
      x = Math.max(8, x - rect.width);
    }
    // Flip vertically if menu would overflow bottom edge
    if (y + rect.height > vh - 8) {
      y = Math.max(8, y - rect.height);
    }

    setAdjusted({ x, y });
  }, [position]);

  const handleItemClick = useCallback(
    (item: ContextMenuItem) => {
      if (item.disabled) return;
      item.onClick();
      onClose();
    },
    [onClose],
  );

  if (!position) return null;

  const pos = adjusted ?? position;

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] min-w-[200px] rounded-lg py-1 shadow-xl"
      style={{
        left: pos.x,
        top: pos.y,
        background: "var(--background-surface-200)",
        border: "1px solid var(--border-strong)",
        backdropFilter: "blur(12px)",
      }}
    >
      {items.map((item) => (
        <div key={item.id}>
          {item.separator && (
            <div
              className="mx-2 my-1"
              style={{
                height: 1,
                background: "var(--border-default)",
              }}
            />
          )}
          <button
            onClick={() => handleItemClick(item)}
            disabled={item.disabled}
            className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[12px] transition-colors"
            style={{
              color: item.disabled
                ? "var(--foreground-muted)"
                : "var(--foreground-light)",
              cursor: item.disabled ? "default" : "pointer",
            }}
            onMouseEnter={(e) => {
              if (!item.disabled) {
                e.currentTarget.style.background =
                  "var(--background-surface-300)";
                e.currentTarget.style.color = "var(--foreground-default)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = item.disabled
                ? "var(--foreground-muted)"
                : "var(--foreground-light)";
            }}
          >
            {item.icon && (
              <span className="flex shrink-0 items-center" style={{ color: "var(--foreground-lighter)" }}>
                {item.icon}
              </span>
            )}
            <span>{item.label}</span>
          </button>
        </div>
      ))}
    </div>
  );
}
