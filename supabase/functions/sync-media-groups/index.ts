import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // First, get all media groups that need updating
    const { data: mediaGroups, error: groupError } = await supabase
      .from('telegram_media')
      .select('telegram_data->media_group_id')
      .not('telegram_data->media_group_id', 'is', null)
      .distinct();

    if (groupError) throw groupError;

    let updatedGroups = 0;
    let syncedMedia = 0;

    // Process each media group
    for (const group of (mediaGroups || [])) {
      const mediaGroupId = group.media_group_id;
      if (!mediaGroupId) continue;

      // Get the most recent telegram_media record with analyzed content
      const { data: latestMedia } = await supabase
        .from('telegram_media')
        .select('*')
        .eq('telegram_data->>media_group_id', mediaGroupId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!latestMedia) continue;

      // Update or create media_group
      const { error: upsertError } = await supabase
        .from('media_groups')
        .upsert({
          media_group_id: mediaGroupId,
          caption: latestMedia.caption,
          analyzed_content: latestMedia.analyzed_content,
          product_name: latestMedia.product_name,
          product_code: latestMedia.product_code,
          quantity: latestMedia.quantity,
          vendor_uid: latestMedia.vendor_uid,
          purchase_date: latestMedia.purchase_date,
          notes: latestMedia.notes
        });

      if (upsertError) {
        console.error(`Error updating media group ${mediaGroupId}:`, upsertError);
        continue;
      }

      updatedGroups++;

      // Sync all media in the group
      const { error: syncError } = await supabase
        .rpc('sync_media_group_captions', { media_group_id: mediaGroupId });

      if (!syncError) {
        syncedMedia++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        updated_groups: updatedGroups,
        synced_media: syncedMedia
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in sync-media-groups:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});