import { type FC } from 'react'

export interface EntityType {
  id: string
  label: string
  icon: string
  color: string
}

const ENTITY_TYPES: EntityType[] = [
  { id: 'note', label: 'Note', icon: '\u{1F4DD}', color: 'violet' },
  { id: 'agent', label: 'Agent', icon: '\u{1F916}', color: 'emerald' },
  { id: 'skill', label: 'Skill', icon: '\u26A1', color: 'amber' },
  { id: 'workflow', label: 'Workflow', icon: '\u{1F504}', color: 'blue' },
  { id: 'doc', label: 'Doc', icon: '\u{1F4C4}', color: 'cyan' },
  { id: 'feature', label: 'Feature', icon: '\u{1F680}', color: 'pink' },
  { id: 'plan', label: 'Plan', icon: '\u{1F4CB}', color: 'orange' },
  { id: 'request', label: 'Request', icon: '\u{1F4E8}', color: 'rose' },
  { id: 'person', label: 'Person', icon: '\u{1F464}', color: 'teal' },
  { id: 'health-brief', label: 'Health Brief', icon: '\u{1F48A}', color: 'lime' },
]

interface SmartActionsGridProps {
  onSelect: (entity: EntityType) => void
}

const SmartActionsGrid: FC<SmartActionsGridProps> = ({ onSelect }) => {
  return (
    <div className="grid grid-cols-5 gap-3">
      {ENTITY_TYPES.map((entity) => {
        return (
          <button
            key={entity.id}
            onClick={() => onSelect(entity)}
            className="group flex flex-col items-center gap-2 rounded-lg p-4 transition-all hover:scale-[1.03] active:scale-[0.98]"
            style={{
              background: 'var(--background-surface-200)',
              border: '1px solid var(--border-default)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-strong)'
              e.currentTarget.style.background = 'var(--background-surface-300)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-default)'
              e.currentTarget.style.background = 'var(--background-surface-200)'
            }}
          >
            <span className="text-2xl">{entity.icon}</span>
            <span className="text-xs font-medium" style={{ color: 'var(--foreground-light)' }}>
              {entity.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export { ENTITY_TYPES }
export default SmartActionsGrid
