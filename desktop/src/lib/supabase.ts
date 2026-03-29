import { createClient } from "@supabase/supabase-js";

// Self-hosted Supabase via Kong gateway
const SUPABASE_URL = "http://localhost:8000";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc0NjgyNDI5LCJleHAiOjE5MzIzNjI0Mjl9.hElxzzeyp5bXoLG7WiqddiPYiDSx4m3VMUs8qHjckyI";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // Desktop app, no URL-based auth
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export { SUPABASE_URL, SUPABASE_ANON_KEY };
