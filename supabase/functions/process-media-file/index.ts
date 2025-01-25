import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withDatabaseRetry } from "../_shared/database-retry.ts";
import { getAndDownloadTelegramFile } from "../_shared/telegram-service.ts";
import { uploadMediaToStorage } from "../_shared/storage-manager.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileId, fileUniqueId, fileType, messageId, botToken } = await req.json();

    if (!fileId || !fileUniqueId || !fileType || !messageId || !botToken) {
      throw new Error('Missing required parameters');
    }

    console.log('Processing media file:', {
      file_id: fileId,
      file_unique_id: fileUniqueId,
      file_type: fileType,
      message_id: messageId
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if media already exists
    const { data: existingMedia } = await supabase
      .from('telegram_media')
      .select('id, public_url, message_media_data')
      .eq('file_unique_id', fileUniqueId)
      .maybeSingle();

    if (existingMedia?.public_url) {
      console.log('Media already processed:', existingMedia);
      return new Response(
        JSON.stringify(existingMedia),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Download and process the file
    console.log('Downloading file from Telegram:', fileId);
    const { buffer, filePath } = await getAndDownloadTelegramFile(fileId, botToken);

    // Generate safe filename using file_unique_id
    const fileExt = filePath.split('.').pop() || 'bin';
    const fileName = `${fileUniqueId}.${fileExt}`;

    console.log('Uploading file to storage:', fileName);
    
    // Upload to Supabase Storage
    const { publicUrl } = await uploadMediaToStorage(
      supabase,
      buffer,
      fileUniqueId,
      fileExt,
      fileType === 'photo' ? 'image/jpeg' : undefined
    );

    if (!publicUrl) {
      throw new Error('Failed to get public URL after upload');
    }

    // Update queue item with success status
    const { data: queueItem, error: queueError } = await withDatabaseRetry(
      async () => {
        return await supabase
          .from('unified_processing_queue')
          .update({
            status: 'processed',
            processed_at: new Date().toISOString(),
            message_media_data: {
              ...existingMedia?.message_media_data,
              media: {
                ...existingMedia?.message_media_data?.media,
                public_url: publicUrl
              }
            }
          })
          .eq('message_id', messageId)
          .select()
          .single();
      }
    );

    if (queueError) throw queueError;

    console.log('Successfully processed media file:', {
      file_id: fileId,
      public_url: publicUrl,
      queue_item_id: queueItem.id
    });

    return new Response(
      JSON.stringify({ 
        message: 'Media processing completed', 
        publicUrl, 
        queueItemId: queueItem.id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing media:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});