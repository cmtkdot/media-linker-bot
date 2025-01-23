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
      .select('telegram_data->media_group_id, caption')
      .neq('telegram_data->media_group_id', null)
      .limit(1000); // Add a reasonable limit

    if (groupError) throw groupError;

    // Get unique media group IDs
    const uniqueGroups = [...new Set(mediaGroups?.map(g => g.media_group_id))];
    
    let updatedGroups = 0;
    let syncedMedia = 0;

    // Process each media group
    for (const mediaGroupId of uniqueGroups) {
      if (!mediaGroupId) continue;

      console.log('Processing media group:', mediaGroupId);

      // Get all media in this group
      const { data: groupMedia } = await supabase
        .from('telegram_media')
        .select('*')
        .eq('telegram_data->>media_group_id', mediaGroupId)
        .order('created_at', { ascending: false });

      if (!groupMedia?.length) continue;

      // Find the first item with a caption
      const mediaWithCaption = groupMedia.find(m => m.caption);
      
      if (mediaWithCaption && (!mediaWithCaption.analyzed_content || Object.keys(mediaWithCaption.analyzed_content).length === 0)) {
        console.log('Analyzing caption for media group:', mediaGroupId);
        
        // Call analyze-caption function
        const { data: analyzedContent, error: analysisError } = await supabase.functions.invoke('analyze-caption', {
          body: { 
            caption: mediaWithCaption.caption,
            messageId: mediaWithCaption.id,
            mediaGroupId: mediaGroupId
          }
        });

        if (analysisError) {
          console.error('Error analyzing caption:', analysisError);
          continue;
        }

        console.log('Analyzed content:', analyzedContent);

        // Update media_groups table
        const { error: upsertError } = await supabase
          .from('media_groups')
          .upsert({
            media_group_id: mediaGroupId,
            caption: mediaWithCaption.caption,
            analyzed_content: analyzedContent,
            product_name: analyzedContent?.product_name,
            product_code: analyzedContent?.product_code,
            quantity: analyzedContent?.quantity,
            vendor_uid: analyzedContent?.vendor_uid,
            purchase_date: analyzedContent?.purchase_date,
            notes: analyzedContent?.notes,
            sync_status: 'completed'
          });

        if (upsertError) {
          console.error('Error updating media group:', upsertError);
          continue;
        }

        updatedGroups++;

        // Sync all media in the group
        const { error: syncError } = await supabase
          .from('telegram_media')
          .update({
            caption: mediaWithCaption.caption,
            analyzed_content: analyzedContent,
            product_name: analyzedContent?.product_name,
            product_code: analyzedContent?.product_code,
            quantity: analyzedContent?.quantity,
            vendor_uid: analyzedContent?.vendor_uid,
            purchase_date: analyzedContent?.purchase_date,
            notes: analyzedContent?.notes
          })
          .eq('telegram_data->>media_group_id', mediaGroupId);

        if (!syncError) {
          syncedMedia += groupMedia.length;
        }
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