import { createClient } from '@supabase/supabase-js';

export const createClient = () => {
  const supabaseUrl = 'https://kzfamethztziwqiocbwz.supabase.co';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return createClient(supabaseUrl, supabaseKey);
};