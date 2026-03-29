import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type FC,
} from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CommandAction {
  id: string;
  label: string;
  category: string;
  icon: JSX.Element;
  shortcut?: string;
  onSelect: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Fuzzy-match helper                                                 */
/* ------------------------------------------------------------------ */

function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

function matchScore(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.startsWith(q)) return 3;
  if (t.includes(q)) return 2;
  if (fuzzyMatch(q, t)) return 1;
  return 0;
}

/* ------------------------------------------------------------------ */
/*  Shared SVG icon helpers                                            */
/* ------------------------------------------------------------------ */

const iconCls = "h-4 w-4 shrink-0";

const Icons = {
  dashboard: (
    <svg className={iconCls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="1" width="6" height="6" rx="1" />
      <rect x="9" y="1" width="6" height="6" rx="1" />
      <rect x="1" y="9" width="6" height="6" rx="1" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </svg>
  ),
  editor: (
    <svg className={iconCls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 4L2 8L5 12" />
      <path d="M11 4L14 8L11 12" />
      <path d="M9 2L7 14" />
    </svg>
  ),
  settings: (
    <svg className={iconCls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1V3M8 13V15M1 8H3M13 8H15M2.9 2.9L4.3 4.3M11.7 11.7L13.1 13.1M13.1 2.9L11.7 4.3M4.3 11.7L2.9 13.1" />
    </svg>
  ),
  task: (
    <svg className={iconCls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="12" height="12" rx="2" />
      <path d="M5 8L7 10L11 6" />
    </svg>
  ),
  taskList: (
    <svg className={iconCls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4H5M2 8H5M2 12H5" />
      <path d="M7 4H14M7 8H14M7 12H14" />
    </svg>
  ),
  taskDone: (
    <svg className={iconCls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6" />
      <path d="M5.5 8L7.5 10L10.5 6" />
    </svg>
  ),
  agents: (
    <svg className={iconCls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="5" r="2.5" />
      <path d="M1.5 14C1.5 11.5 3.5 9.5 6 9.5C8.5 9.5 10.5 11.5 10.5 14" />
      <circle cx="11.5" cy="5.5" r="2" />
      <path d="M14.5 14C14.5 12 13 10 11.5 10" />
    </svg>
  ),
  play: (
    <svg className={iconCls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 3L13 8L4 13V3Z" />
    </svg>
  ),
  file: (
    <svg className={iconCls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 1H4C3.45 1 3 1.45 3 2V14C3 14.55 3.45 15 4 15H12C12.55 15 13 14.55 13 14V5L9 1Z" />
      <path d="M9 1V5H13" />
    </svg>
  ),
  newDoc: (
    <svg className={iconCls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 1H4C3.45 1 3 1.45 3 2V14C3 14.55 3.45 15 4 15H12C12.55 15 13 14.55 13 14V5L9 1Z" />
      <path d="M8 7V11M6 9H10" />
    </svg>
  ),
  download: (
    <svg className={iconCls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2V10M8 10L5 7M8 10L11 7" />
      <path d="M3 12V13C3 13.55 3.45 14 4 14H12C12.55 14 13 13.55 13 13V12" />
    </svg>
  ),
  theme: (
    <svg className={iconCls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 2V14" />
      <path d="M8 2C11.3 2 14 4.7 14 8C14 11.3 11.3 14 8 14" />
    </svg>
  ),
  key: (
    <svg className={iconCls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5.5" cy="10.5" r="3" />
      <path d="M8 8L14 2" />
      <path d="M11 2H14V5" />
    </svg>
  ),
  prefs: (
    <svg className={iconCls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4H14M2 8H14M2 12H14" />
      <circle cx="5" cy="4" r="1.5" fill="currentColor" />
      <circle cx="11" cy="8" r="1.5" fill="currentColor" />
      <circle cx="7" cy="12" r="1.5" fill="currentColor" />
    </svg>
  ),
  search: (
    <svg className={iconCls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" />
    </svg>
  ),
};

/* ------------------------------------------------------------------ */
/*  Category display order + colors                                    */
/* ------------------------------------------------------------------ */

const CATEGORY_ORDER = ["Navigation", "Tasks", "Agents", "Quick Actions", "Settings"];

const CATEGORY_COLORS: Record<string, string> = {
  Navigation: "hsl(210 100% 66%)",
  Tasks: "hsl(263 70% 70%)",
  Agents: "hsl(153.1 60.2% 52.7%)",
  "Quick Actions": "hsl(38 92% 60%)",
  Settings: "hsl(0 0% 53.7%)",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const CommandPalette: FC<CommandPaletteProps> = ({ open, onClose, onNavigate }) => {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  /* ---- Build the actions list ---- */
  const actions: CommandAction[] = useMemo(
    () => [
      // Navigation
      {
        id: "nav-dashboard",
        label: "Go to Dashboard",
        category: "Navigation",
        icon: Icons.dashboard,
        shortcut: "D",
        onSelect: () => { onNavigate("dashboard"); onClose(); },
      },
      {
        id: "nav-editor",
        label: "Go to Editor",
        category: "Navigation",
        icon: Icons.editor,
        shortcut: "E",
        onSelect: () => { onNavigate("editor"); onClose(); },
      },
      {
        id: "nav-settings",
        label: "Go to Settings",
        category: "Navigation",
        icon: Icons.settings,
        shortcut: ",",
        onSelect: () => { onNavigate("settings"); onClose(); },
      },

      // Tasks
      {
        id: "task-create",
        label: "Create Task",
        category: "Tasks",
        icon: Icons.task,
        onSelect: () => { onNavigate("dashboard"); onClose(); },
      },
      {
        id: "task-active",
        label: "View Active Tasks",
        category: "Tasks",
        icon: Icons.taskList,
        onSelect: () => { onNavigate("dashboard"); onClose(); },
      },
      {
        id: "task-completed",
        label: "View Completed Tasks",
        category: "Tasks",
        icon: Icons.taskDone,
        onSelect: () => { onNavigate("dashboard"); onClose(); },
      },

      // Agents
      {
        id: "agents-team",
        label: "View Team",
        category: "Agents",
        icon: Icons.agents,
        onSelect: () => { onNavigate("dashboard"); onClose(); },
      },
      {
        id: "agents-session",
        label: "Start Agent Session",
        category: "Agents",
        icon: Icons.play,
        onSelect: () => { onNavigate("dashboard"); onClose(); },
      },

      // Quick Actions
      {
        id: "quick-open",
        label: "Open File",
        category: "Quick Actions",
        icon: Icons.file,
        shortcut: "O",
        onSelect: () => { onNavigate("editor"); onClose(); },
      },
      {
        id: "quick-new",
        label: "New Document",
        category: "Quick Actions",
        icon: Icons.newDoc,
        shortcut: "N",
        onSelect: () => { onNavigate("editor"); onClose(); },
      },
      {
        id: "quick-export",
        label: "Export Current",
        category: "Quick Actions",
        icon: Icons.download,
        onSelect: () => { onClose(); },
      },

      // Settings
      {
        id: "settings-theme",
        label: "Toggle Theme",
        category: "Settings",
        icon: Icons.theme,
        onSelect: () => { onNavigate("settings"); onClose(); },
      },
      {
        id: "settings-token",
        label: "Configure MCP Token",
        category: "Settings",
        icon: Icons.key,
        onSelect: () => { onNavigate("settings"); onClose(); },
      },
      {
        id: "settings-prefs",
        label: "Open Preferences",
        category: "Settings",
        icon: Icons.prefs,
        onSelect: () => { onNavigate("settings"); onClose(); },
      },
    ],
    [onNavigate, onClose],
  );

  /* ---- Filter by query ---- */
  const filtered = useMemo(() => {
    if (!query.trim()) return actions;
    return actions
      .map((a) => ({
        action: a,
        score: Math.max(
          matchScore(query, a.label),
          matchScore(query, a.category),
        ),
      }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.action);
  }, [query, actions]);

  /* ---- Group by category, preserving order ---- */
  const grouped = useMemo(() => {
    const map = new Map<string, CommandAction[]>();
    for (const action of filtered) {
      const list = map.get(action.category) || [];
      list.push(action);
      map.set(action.category, list);
    }
    const result: { category: string; items: CommandAction[] }[] = [];
    for (const cat of CATEGORY_ORDER) {
      const items = map.get(cat);
      if (items && items.length > 0) result.push({ category: cat, items });
    }
    return result;
  }, [filtered]);

  /* ---- Flat list for keyboard navigation ---- */
  const flatItems = useMemo(
    () => grouped.flatMap((g) => g.items),
    [grouped],
  );

  /* ---- Reset state when opening ---- */
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  /* ---- Clamp selection when list changes ---- */
  useEffect(() => {
    setSelectedIndex((prev) => Math.min(prev, Math.max(flatItems.length - 1, 0)));
  }, [flatItems.length]);

  /* ---- Scroll selected item into view ---- */
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.querySelector("[data-selected='true']");
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  /* ---- Keyboard handler ---- */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < flatItems.length - 1 ? prev + 1 : 0,
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : flatItems.length - 1,
          );
          break;
        case "Enter":
          e.preventDefault();
          if (flatItems[selectedIndex]) {
            flatItems[selectedIndex].onSelect();
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [flatItems, selectedIndex, onClose],
  );

  /* ---- Overlay click to close ---- */
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  if (!open) return null;

  /* ---- Shared inline-style helpers (uses CSS vars from theme) ---- */
  const kbdStyle: React.CSSProperties = {
    background: "var(--background-surface-300)",
    border: "1px solid var(--border-strong)",
    borderRadius: "var(--border-radius-sm)",
    color: "var(--foreground-muted)",
    padding: "1px 5px",
    fontSize: "10px",
    fontWeight: 500,
    lineHeight: "16px",
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-start justify-center"
      style={{
        paddingTop: "min(20vh, 160px)",
        background: "rgba(0, 0, 0, 0.55)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      <div
        className="w-full max-w-xl overflow-hidden"
        style={{
          background: "var(--background-overlay-default)",
          border: "1px solid var(--border-overlay)",
          borderRadius: "var(--border-radius-xl)",
          boxShadow: "0 25px 60px -12px rgba(0, 0, 0, 0.6)",
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ borderBottom: "1px solid var(--border-default)" }}
        >
          <span style={{ color: "var(--foreground-lighter)" }}>
            {Icons.search}
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent text-sm focus:outline-none"
            style={{
              color: "var(--foreground-default)",
            }}
            autoFocus
          />
          <kbd style={kbdStyle}>ESC</kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="overflow-y-auto p-2"
          style={{ maxHeight: "360px" }}
        >
          {flatItems.length === 0 ? (
            <div
              className="px-3 py-8 text-center text-sm"
              style={{ color: "var(--foreground-muted)" }}
            >
              No matching actions found.
            </div>
          ) : (
            grouped.map((group) => {
              const catColor = CATEGORY_COLORS[group.category] || "var(--foreground-lighter)";
              return (
                <div key={group.category} className="mb-1 last:mb-0">
                  <p
                    className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: catColor }}
                  >
                    {group.category}
                  </p>
                  {group.items.map((item) => {
                    const idx = flatItems.indexOf(item);
                    const isSelected = idx === selectedIndex;
                    return (
                      <button
                        key={item.id}
                        data-selected={isSelected}
                        onClick={() => item.onSelect()}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors"
                        style={{
                          borderRadius: "var(--border-radius-lg)",
                          background: isSelected
                            ? "var(--background-selection)"
                            : "transparent",
                          color: isSelected
                            ? "var(--foreground-default)"
                            : "var(--foreground-light)",
                        }}
                        onMouseLeave={(e) => {
                          if (idx !== selectedIndex) {
                            e.currentTarget.style.background = "transparent";
                          }
                        }}
                      >
                        <span
                          style={{
                            color: isSelected
                              ? "var(--brand-default)"
                              : "var(--foreground-muted)",
                          }}
                        >
                          {item.icon}
                        </span>
                        <span className="flex-1">{item.label}</span>
                        {item.shortcut && (
                          <kbd style={kbdStyle}>{item.shortcut}</kbd>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-4 py-2"
          style={{
            borderTop: "1px solid var(--border-default)",
            color: "var(--foreground-muted)",
            fontSize: "10px",
          }}
        >
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd style={kbdStyle}>&uarr;</kbd>
              <kbd style={kbdStyle}>&darr;</kbd>
              <span className="ml-0.5">navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd style={kbdStyle}>&crarr;</kbd>
              <span className="ml-0.5">select</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd style={kbdStyle}>esc</kbd>
              <span className="ml-0.5">close</span>
            </span>
          </div>
          <span>
            {flatItems.length} action{flatItems.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
