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
  serviceLogs: (
    projectRef: string | undefined,
    service: string,
    level: string | undefined,
    hours: number
  ) => ['projects', projectRef, 'orchestra', 'service-logs', service, level, hours] as const,
  agentDetail: (projectRef: string | undefined, agentId: string | undefined) =>
    ['projects', projectRef, 'orchestra', 'agent-detail', agentId] as const,
  agentActivity: (projectRef: string | undefined, agentId: string | undefined) =>
    ['projects', projectRef, 'orchestra', 'agent-activity', agentId] as const,
  agentTasks: (projectRef: string | undefined, agentId: string | undefined) =>
    ['projects', projectRef, 'orchestra', 'agent-tasks', agentId] as const,
  agentSkills: (projectRef: string | undefined, agentId: string | undefined) =>
    ['projects', projectRef, 'orchestra', 'agent-skills', agentId] as const,
  agentSessions: (projectRef: string | undefined, agentId: string | undefined) =>
    ['projects', projectRef, 'orchestra', 'agent-sessions', agentId] as const,
  taskDistribution: (projectRef: string | undefined) =>
    ['projects', projectRef, 'orchestra', 'task-distribution'] as const,
  agentLeaderboard: (projectRef: string | undefined) =>
    ['projects', projectRef, 'orchestra', 'agent-leaderboard'] as const,
  projectProgress: (projectRef: string | undefined) =>
    ['projects', projectRef, 'orchestra', 'project-progress'] as const,
}
