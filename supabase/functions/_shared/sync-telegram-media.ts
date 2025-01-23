import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function syncTelegramMediaToGlide(record: any) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if we have an active Glide config
    const { data: glideConfig } = await supabase
      .from('glide_config')
      .select('*')
      .eq('active', true)
      .maybeSingle();

    if (!glideConfig) {
      console.log('No active Glide config found, skipping sync');
      return;
    }

    // Trigger the sync function
    const { error: syncError } = await supabase.functions.invoke('sync-glide-media-table', {
      body: {
        operation: 'syncDirect',
        record
      }
    });

    if (syncError) {
      console.error('Error triggering sync:', syncError);
      throw syncError;
    }

    console.log('Successfully triggered sync for record:', record.id);
  } catch (error) {
    console.error('Error in syncTelegramMediaToGlide:', error);
    throw error;
  }
}