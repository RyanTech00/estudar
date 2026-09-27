// Fill these in with your own Supabase project (Project Settings → API).
// The anon/publishable key is meant to be public: row level security in
// supabase/migrations protects each user's data.
// Leave them empty to run the app in local-only mode (no login, no sync, no AI).
export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';

// Sign-in methods shown on the login screen.
// Google requires configuring the provider in Supabase (Authentication → Providers).
export const AUTH_METHODS = { email: true, google: false };
