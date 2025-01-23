import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getFileFromTelegram(fileId: string) {
  // Get file path
  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`
  );
  const data = await response.json();
  
  if (!data.ok || !data.result.file_path) {
    throw new Error('Failed to get file path from Telegram');
  }

  // Download file
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

    // Get videos that need thumbnail regeneration
    const { data: videos, error: queryError } = await supabase
      .from('telegram_media')
      .select('*')
      .eq('file_type', 'video')
      .is('thumbnail_url', null);

    if (queryError) throw queryError;

    console.log(`Found ${videos?.length || 0} videos needing thumbnails`);

    const results = [];
    for (const video of videos || []) {
      try {
        const thumbData = video.telegram_data?.message_data?.video?.thumb;
        if (!thumbData?.file_id) continue;

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

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('media')
          .getPublicUrl(filename);

        // Update telegram_media record
        const { error: updateError } = await supabase
          .from('telegram_media')
          .update({ thumbnail_url: publicUrl })
          .eq('id', video.id);

        if (updateError) throw updateError;

        results.push({
          id: video.id,
          status: 'success',
          thumbnail_url: publicUrl
        });

        console.log(`Successfully processed video ${video.id}`);
      } catch (error) {
        console.error(`Error processing video ${video.id}:`, error);
        results.push({
          id: video.id,
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