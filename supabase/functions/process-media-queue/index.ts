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
        // Extract media info from structured message_media_data
        const mediaInfo = item.message_media_data?.meta?.extracted_fields;
        const fileId = mediaInfo?.file_id;
        const fileUniqueId = mediaInfo?.file_unique_id;
        
        console.log('Processing item:', {
          file_id: fileId,
          file_unique_id: fileUniqueId,
          correlation_id: item.correlation_id
        });

        if (!fileId || !fileUniqueId) {
          throw new Error('Missing required media information');
        }

        // Download file from Telegram
        const fileInfoResponse = await fetch(
          `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
        );
        const fileInfo = await fileInfoResponse.json();
        
        if (!fileInfo.ok || !fileInfo.result.file_path) {
          throw new Error('Failed to get file info from Telegram');
        }

        const fileResponse = await fetch(
          `https://api.telegram.org/file/bot${botToken}/${fileInfo.result.file_path}`
        );
        const fileBuffer = await fileResponse.arrayBuffer();

        // Determine file type and generate storage path
        const fileType = item.message_media_data?.media?.file_type || 'photo';
        const storagePath = `${fileUniqueId}${
          fileType === 'photo' ? '.jpg' :
          fileType === 'video' ? '.mp4' :
          fileType === 'document' ? '.pdf' :
          '.bin'
        }`;

        // Upload to storage
        const { error: uploadError } = await supabaseClient.storage
          .from('media')
          .upload(storagePath, fileBuffer, {
            contentType: fileType === 'photo' ? 'image/jpeg' :
                        fileType === 'video' ? 'video/mp4' :
                        fileType === 'document' ? 'application/pdf' :
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
            file_id: fileId,
            file_unique_id: fileUniqueId,
            file_type: fileType,
            public_url: publicUrl,
            storage_path: storagePath,
            message_media_data: {
              ...item.message_media_data,
              media: {
                file_id: fileId,
                file_unique_id: fileUniqueId,
                file_type: fileType,
                public_url: publicUrl,
                storage_path: storagePath
              }
            },
            correlation_id: item.correlation_id,
            telegram_data: item.message_media_data.telegram_data,
            processed: true
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
                file_id: fileId,
                file_unique_id: fileUniqueId,
                file_type: fileType,
                public_url: publicUrl,
                storage_path: storagePath
              },
              meta: {
                ...item.message_media_data.meta,
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