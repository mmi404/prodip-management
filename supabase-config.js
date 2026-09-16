// Shared Supabase connection info for every PVMS page.
// The anon/publishable key is meant to be public — it's safe in client code.
// Real access control lives in the database's Row Level Security policies
// (see supabase/schema.sql), not in this key.
window.SUPABASE_URL = 'https://pgfkliimocgalzctnded.supabase.co';
window.SUPABASE_ANON_KEY = 'sb_publishable_BqK2UBHYu-6J00kXBpk5lw_J9qtCzHf';
