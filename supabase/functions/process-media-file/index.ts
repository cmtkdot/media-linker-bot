import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { uploadMediaToStorage } from "../_shared/storage-manager.ts";
import { validateMediaFile, getMediaType } from "../_shared/media-validators.ts";

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

    // Get file from Telegram
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
    );

    if (!response.ok) {
      throw new Error(`Failed to get file info: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.ok || !data.result.file_path) {
      throw new Error('Failed to get file path from Telegram');
    }

    const filePath = data.result.file_path;
    
    // Download file from Telegram
    const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
    const fileResponse = await fetch(downloadUrl);

    if (!fileResponse.ok) {
      throw new Error(`Failed to download file: ${fileResponse.statusText}`);
    }

    const buffer = await fileResponse.arrayBuffer();

    console.log('File downloaded successfully, uploading to storage...');

    // Upload to Supabase Storage with verification
    const { publicUrl, storagePath } = await uploadMediaToStorage(
      supabase,
      buffer,
      fileUniqueId,
      fileType
    );

    console.log('File uploaded successfully:', {
      public_url: publicUrl,
      storage_path: storagePath
    });

    // Get message data for updating
    const { data: message } = await supabase
      .from('messages')
      .select('message_media_data, correlation_id')
      .eq('id', messageId)
      .single();

    if (!message) {
      throw new Error('Message not found');
    }

    // Update message_media_data with new file information
    const updatedMessageMediaData = {
      ...message.message_media_data,
      media: {
        ...message.message_media_data.media,
        file_id: fileId,
        file_unique_id: fileUniqueId,
        file_type: fileType,
        public_url: publicUrl,
        storage_path: storagePath
      },
      meta: {
        ...message.message_media_data.meta,
        status: 'processed',
        processed_at: new Date().toISOString()
      }
    };

    // Update telegram_media with verified storage information
    const { error: updateError } = await supabase
      .from('telegram_media')
      .update({
        public_url: publicUrl,
        storage_path: storagePath,
        processed: true,
        message_media_data: updatedMessageMediaData,
        updated_at: new Date().toISOString()
      })
      .eq('message_id', messageId);

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({ 
        message: 'Media processing completed',
        publicUrl,
        storagePath
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing media:', error);
    
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      await supabase
        .from('media_processing_logs')
        .insert({
          message_id: messageId,
          file_id: fileId,
          file_type: fileType,
          error_message: error.message,
          status: 'error'
        });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});