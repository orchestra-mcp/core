export const orchestraKeys = {
  dashboard: (projectRef: string | undefined) =>
    ['projects', projectRef, 'orchestra', 'dashboard'] as const,
  agents: (projectRef: string | undefined) =>
    ['projects', projectRef, 'orchestra', 'agents'] as const,
  tokens: (projectRef: string | undefined) =>
    ['projects', projectRef, 'orchestra', 'tokens'] as const,
  activityLog: (projectRef: string | undefined) =>
    ['projects', projectRef, 'orchestra', 'activity-log'] as const,
  activeSessions: (projectRef: string | undefined) =>
    ['projects', projectRef, 'orchestra', 'active-sessions'] as const,
}
