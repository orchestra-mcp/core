export interface User {
    id: number
    name: string
    email: string
    orchestra_id: string
    avatar_url: string | null
}

export interface PageProps {
    auth: {
        user: User | null
    }
    flash: {
        success: string | null
        error: string | null
    }
    config: {
        supabase_url: string
        supabase_anon_key: string
    }
}

export interface StatData {
    totalTokens: number
    totalAgents: number
    totalTeamMembers: number
    totalTasks: number
}

export interface ActivityItem {
    id: string
    description: string
    time: string
    prefix: string
}

export interface AgentItem {
    id: string
    name: string
    slug: string
    role: string
    type: string
    status: 'active' | 'inactive' | 'archived'
    avatar_color: string | null
    skills: string[] | null
    created_at: string
}

export interface TokenItem {
    id: string
    name: string
    token_prefix: string
    scopes: string
    last_used_at: string | null
    expires_at: string | null
    revoked_at: string | null
    created_at: string
    is_valid: boolean
}

export interface NotificationItem {
    id: string
    type: string
    title: string
    body: string
    action_url: string | null
    read: boolean
    type_color: string
    created_at: string
}
