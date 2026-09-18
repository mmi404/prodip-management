import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pgfkliimocgalzctnded.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_BqK2UBHYu-6J00kXBpk5lw_J9qtCzHf';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
