import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
      .in('status', ['pending'])
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
        // Extract media info from message_media_data structure
        const mediaData = item.message_media_data?.media;
        const messageData = item.message_media_data?.message;
        
        console.log('Processing media data:', {
          file_id: mediaData?.file_id,
          file_type: mediaData?.file_type,
          message_id: messageData?.message_id,
          media_group_id: messageData?.media_group_id
        });

        if (!mediaData?.file_id) {
          throw new Error('Missing required media data: file_id');
        }

        // Download file from Telegram
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

        // Generate storage path using file_unique_id and type
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
            message_media_data: {
              ...item.message_media_data,
              media: {
                ...mediaData,
                public_url: publicUrl,
                storage_path: storagePath
              }
            },
            message_id: item.message_media_data?.message?.message_id,
            correlation_id: item.correlation_id,
            processed: true,
            caption: messageData?.caption,
            is_original_caption: item.message_media_data?.meta?.is_original_caption,
            original_message_id: item.message_media_data?.meta?.original_message_id
          });

        if (mediaError) throw mediaError;

        // Update queue status
        await supabaseClient
          .from('unified_processing_queue')
          .update({
            status: 'processed',
            processed_at: new Date().toISOString(),
            message_media_data: {
              ...item.message_media_data,
              media: {
                ...mediaData,
                public_url: publicUrl,
                storage_path: storagePath
              },
              meta: {
                ...item.message_media_data?.meta,
                status: 'processed',
                processed_at: new Date().toISOString()
              }
            }
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
            retry_count: (item.retry_count || 0) + 1,
            message_media_data: {
              ...item.message_media_data,
              meta: {
                ...item.message_media_data?.meta,
                status: 'error',
                error: error.message
              }
            }
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
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error in process-media-queue:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});