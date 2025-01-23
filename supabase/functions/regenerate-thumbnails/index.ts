import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getFileFromTelegram(fileId: string) {
  console.log('Getting file from Telegram:', fileId);
  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`
  );
  const data = await response.json();
  
  if (!data.ok || !data.result.file_path) {
    throw new Error('Failed to get file path from Telegram');
  }

  const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${data.result.file_path}`;
  const fileResponse = await fetch(fileUrl);
  return await fileResponse.arrayBuffer();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting thumbnail regeneration process...');
    
    // Get all videos with Telegram thumbnail data
    const { data: videos, error: queryError } = await supabase
      .from('telegram_media')
      .select('*')
      .eq('file_type', 'video')
      .not('telegram_data->>message_data', 'null');

    if (queryError) throw queryError;

    console.log(`Found ${videos?.length || 0} videos to process`);

    const results = [];
    for (const video of videos || []) {
      try {
        const thumbData = video.telegram_data?.message_data?.video?.thumb;
        if (!thumbData?.file_id) {
          console.log(`No thumb data for video ${video.id}`);
          continue;
        }

        console.log(`Processing video ${video.id}: ${video.file_unique_id}`);

        // Download thumbnail from Telegram
        const buffer = await getFileFromTelegram(thumbData.file_id);
        const filename = `${thumbData.file_unique_id}.jpg`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(filename, buffer, {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw uploadError;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('media')
          .getPublicUrl(filename);

        // Update telegram_media record
        const { error: updateError } = await supabase
          .from('telegram_media')
          .update({ 
            thumbnail_url: publicUrl,
            media_metadata: {
              ...video.media_metadata,
              thumbnail: {
                file_id: thumbData.file_id,
                file_unique_id: thumbData.file_unique_id,
                width: thumbData.width,
                height: thumbData.height,
                storage_path: filename,
                public_url: publicUrl
              }
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', video.id);

        if (updateError) {
          console.error('Update error:', updateError);
          throw updateError;
        }

        results.push({
          id: video.id,
          file_unique_id: video.file_unique_id,
          status: 'success',
          old_thumbnail: video.thumbnail_url,
          new_thumbnail: publicUrl
        });

        console.log(`Successfully processed video ${video.id}`);
      } catch (error) {
        console.error(`Error processing video ${video.id}:`, error);
        results.push({
          id: video.id,
          file_unique_id: video.file_unique_id,
          status: 'error',
          error: error.message
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: results.length,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in thumbnail regeneration:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});