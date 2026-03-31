import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'FATAL: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in production.'
    );
  }
  console.warn(
    'Supabase admin environment variables are not configured. Some server-side operations may fail.'
  );
}

export const supabaseAdmin = createClient(url || '', serviceRoleKey || '', {
  auth: {
    persistSession: false
  }
});

