import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kzfamethztziwqiocbwz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6ZmFtZXRoenR6aXdxaW9jYnd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc0MjUwNTksImV4cCI6MjA1MzAwMTA1OX0.O7fKEwzBFsIl8dvDNBzNDQBb0egbINX1HO1n7mkSNKA';

export const createSupabaseClient = createClient(supabaseUrl, supabaseAnonKey);