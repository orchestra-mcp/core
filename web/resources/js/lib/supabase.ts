import { createClient, SupabaseClient } from '@supabase/supabase-js'

let supabaseInstance: SupabaseClient | null = null

/**
 * Get or create the Supabase client singleton.
 * Uses config passed from Laravel via Inertia shared data.
 */
export function getSupabaseClient(url?: string, anonKey?: string): SupabaseClient | null {
    if (supabaseInstance) return supabaseInstance

    const supabaseUrl = url || ''
    const supabaseAnonKey = anonKey || ''

    if (!supabaseUrl || !supabaseAnonKey) {
        return null
    }

    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
        realtime: {
            params: {
                eventsPerSecond: 10,
            },
        },
    })

    return supabaseInstance
}

export default getSupabaseClient
