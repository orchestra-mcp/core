import { type FC } from "react";

export interface EntityType {
  id: string;
  label: string;
  icon: string;
  color: string;
}

const ENTITY_TYPES: EntityType[] = [
  { id: "note", label: "Note", icon: "📝", color: "violet" },
  { id: "agent", label: "Agent", icon: "🤖", color: "emerald" },
  { id: "skill", label: "Skill", icon: "⚡", color: "amber" },
  { id: "workflow", label: "Workflow", icon: "🔄", color: "blue" },
  { id: "doc", label: "Doc", icon: "📄", color: "cyan" },
  { id: "feature", label: "Feature", icon: "🚀", color: "pink" },
  { id: "plan", label: "Plan", icon: "📋", color: "orange" },
  { id: "request", label: "Request", icon: "📨", color: "rose" },
  { id: "person", label: "Person", icon: "👤", color: "teal" },
  { id: "health-brief", label: "Health Brief", icon: "💊", color: "lime" },
];

const COLOR_MAP: Record<string, { bg: string; border: string; text: string }> = {
  violet: { bg: "bg-violet-500/10", border: "border-violet-500/30", text: "text-violet-400" },
  emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400" },
  amber: { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400" },
  blue: { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-400" },
  cyan: { bg: "bg-cyan-500/10", border: "border-cyan-500/30", text: "text-cyan-400" },
  pink: { bg: "bg-pink-500/10", border: "border-pink-500/30", text: "text-pink-400" },
  orange: { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-400" },
  rose: { bg: "bg-rose-500/10", border: "border-rose-500/30", text: "text-rose-400" },
  teal: { bg: "bg-teal-500/10", border: "border-teal-500/30", text: "text-teal-400" },
  lime: { bg: "bg-lime-500/10", border: "border-lime-500/30", text: "text-lime-400" },
};

interface SmartActionsGridProps {
  onSelect: (entity: EntityType) => void;
}

const SmartActionsGrid: FC<SmartActionsGridProps> = ({ onSelect }) => {
  return (
    <div className="grid grid-cols-5 gap-3">
      {ENTITY_TYPES.map((entity) => {
        const colors = COLOR_MAP[entity.color];
        return (
          <button
            key={entity.id}
            onClick={() => onSelect(entity)}
            className={`group flex flex-col items-center gap-2 rounded-xl border ${colors.border} ${colors.bg} p-4 transition-all hover:scale-[1.03] hover:border-opacity-60 hover:shadow-lg hover:shadow-black/20 active:scale-[0.98]`}
          >
            <span className="text-2xl">{entity.icon}</span>
            <span className={`text-xs font-medium ${colors.text}`}>
              {entity.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export { ENTITY_TYPES };
export default SmartActionsGrid;
