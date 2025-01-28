import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!botToken) throw new Error('Bot token not configured');

    // Fetch pending queue items
    const { data: queueItems, error } = await supabaseClient
      .from('unified_processing_queue')
      .select('*')
      .in('status', ['pending', 'processing'])
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(10);

    if (error) throw error;

    if (!queueItems?.length) {
      return new Response(
        JSON.stringify({ message: 'No items to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${queueItems.length} queue items`);
    const processed = [];
    const errors = [];

    for (const item of queueItems) {
      try {
        const mediaData = item.message_media_data?.media;
        if (!mediaData?.file_id) {
          console.log(`Skipping item ${item.id} - missing media data`);
          continue;
        }

        // Download file from Telegram
        console.log(`Downloading file ${mediaData.file_id}`);
        const fileInfoResponse = await fetch(
          `https://api.telegram.org/bot${botToken}/getFile?file_id=${mediaData.file_id}`
        );
        const fileInfo = await fileInfoResponse.json();
        
        if (!fileInfo.ok || !fileInfo.result.file_path) {
          throw new Error('Failed to get file info from Telegram');
        }

        const fileResponse = await fetch(
          `https://api.telegram.org/file/bot${botToken}/${fileInfo.result.file_path}`
        );
        const fileBuffer = await fileResponse.arrayBuffer();

        // Generate storage path
        const storagePath = `${mediaData.file_unique_id}${
          mediaData.file_type === 'photo' ? '.jpg' :
          mediaData.file_type === 'video' ? '.mp4' :
          mediaData.file_type === 'document' ? '.pdf' :
          '.bin'
        }`;

        // Upload to storage
        const { error: uploadError } = await supabaseClient.storage
          .from('media')
          .upload(storagePath, fileBuffer, {
            contentType: mediaData.file_type === 'photo' ? 'image/jpeg' :
                        mediaData.file_type === 'video' ? 'video/mp4' :
                        mediaData.file_type === 'document' ? 'application/pdf' :
                        'application/octet-stream',
            upsert: true
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = await supabaseClient.storage
          .from('media')
          .getPublicUrl(storagePath);

        // Update telegram_media record
        const { error: mediaError } = await supabaseClient
          .from('telegram_media')
          .upsert({
            file_id: mediaData.file_id,
            file_unique_id: mediaData.file_unique_id,
            file_type: mediaData.file_type,
            public_url: publicUrl,
            storage_path: storagePath,
            message_media_data: item.message_media_data,
            correlation_id: item.correlation_id,
            message_id: item.id,
            processed: true
          });

        if (mediaError) throw mediaError;

        // Update queue status
        await supabaseClient
          .from('unified_processing_queue')
          .update({
            status: 'processed',
            processed_at: new Date().toISOString()
          })
          .eq('id', item.id);

        processed.push(item.id);
        console.log(`Successfully processed item ${item.id}`);

      } catch (error) {
        console.error(`Error processing item ${item.id}:`, error);
        errors.push({ id: item.id, error: error.message });
        
        await supabaseClient
          .from('unified_processing_queue')
          .update({
            status: 'error',
            error_message: error.message,
            retry_count: (item.retry_count || 0) + 1
          })
          .eq('id', item.id);
      }
    }

    return new Response(
      JSON.stringify({ 
        processed: processed.length,
        errors: errors.length,
        details: { processed, errors }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-media-queue:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});