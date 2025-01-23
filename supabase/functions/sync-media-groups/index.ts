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

    // First, get all unique media groups
    const { data: mediaGroups, error: groupError } = await supabase
      .from('telegram_media')
      .select('telegram_data->media_group_id')
      .neq('telegram_data->media_group_id', null)
      .limit(1000);

    if (groupError) throw groupError;

    // Get unique media group IDs
    const uniqueGroups = [...new Set(mediaGroups?.map(g => g.media_group_id))];
    
    let updatedGroups = 0;
    let syncedMedia = 0;
    let analyzedCaptions = 0;

    // First, process all individual media items with captions but no analyzed content
    const { data: mediaWithCaptions, error: mediaError } = await supabase
      .from('telegram_media')
      .select('*')
      .not('caption', 'is', null)
      .is('analyzed_content', null);

    if (mediaError) throw mediaError;

    console.log('Processing individual media items:', mediaWithCaptions?.length || 0);

    // Analyze captions for individual items
    for (const media of (mediaWithCaptions || [])) {
      try {
        console.log('Analyzing caption for media:', media.id);
        
        const { data: analyzedContent, error: analysisError } = await supabase.functions.invoke('analyze-caption', {
          body: { 
            caption: media.caption,
            messageId: media.id
          }
        });

        if (analysisError) {
          console.error('Error analyzing caption:', analysisError);
          continue;
        }

        if (analyzedContent) {
          // Update the media record with analyzed content
          const { error: updateError } = await supabase
            .from('telegram_media')
            .update({
              analyzed_content: analyzedContent,
              product_name: analyzedContent?.product_name,
              product_code: analyzedContent?.product_code,
              quantity: analyzedContent?.quantity,
              vendor_uid: analyzedContent?.vendor_uid,
              purchase_date: analyzedContent?.purchase_date,
              notes: analyzedContent?.notes
            })
            .eq('id', media.id);

          if (!updateError) {
            analyzedCaptions++;
          }
        }
      } catch (error) {
        console.error('Error processing media item:', error);
      }
    }

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

        // Update all media in the group with the analyzed content
        const { error: updateError } = await supabase
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

        if (!updateError) {
          updatedGroups++;
          syncedMedia += groupMedia.length;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        updated_groups: updatedGroups,
        synced_media: syncedMedia,
        analyzed_captions: analyzedCaptions
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