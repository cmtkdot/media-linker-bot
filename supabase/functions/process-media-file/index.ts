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
      .select('id, public_url, telegram_data')
      .eq('file_unique_id', fileUniqueId)
      .maybeSingle();

    if (existingMedia?.public_url) {
      console.log('Media already processed:', existingMedia);
      return new Response(
        JSON.stringify(existingMedia),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if part of a media group and if it's synced
    const mediaGroupId = existingMedia?.telegram_data?.media_group_id;
    if (mediaGroupId) {
      const { data: groupSyncStatus } = await supabase.rpc('is_media_group_synced', {
        group_id: mediaGroupId
      });

      if (!groupSyncStatus) {
        console.log('Media group not fully synced yet:', mediaGroupId);
        return new Response(
          JSON.stringify({ message: 'Media group not fully synced', mediaGroupId }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 202 }
        );
      }
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

    // Update media record with public URL through unified queue
    const { data: queueItem, error: queueError } = await withDatabaseRetry(
      async () => {
        return await supabase
          .from('unified_processing_queue')
          .insert({
            queue_type: 'media',
            data: {
              file_id: fileId,
              file_unique_id: fileUniqueId,
              file_type: fileType,
              public_url: publicUrl,
              message_id: messageId
            },
            status: 'pending',
            priority: mediaGroupId ? 2 : 1,
            correlation_id: messageId
          })
          .select()
          .single();
      },
      0,
      `queue_media_update_${fileUniqueId}`
    );

    if (queueError) throw queueError;

    console.log('Successfully processed media file:', {
      file_id: fileId,
      public_url: publicUrl,
      queue_item_id: queueItem.id
    });

    return new Response(
      JSON.stringify({ message: 'Media processing queued', publicUrl, queueItemId: queueItem.id }),
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