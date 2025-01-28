import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withRetry, MediaProcessingError } from "../_shared/error-handler.ts";
import { uploadMediaToStorage } from "../_shared/storage-manager.ts";
import { validateMediaFile } from "../_shared/media-validators.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { 
      fileId, 
      fileUniqueId, 
      fileType, 
      messageId, 
      botToken, 
      correlationId 
    } = await req.json();

    if (!fileId || !fileUniqueId || !fileType || !messageId || !botToken) {
      throw new MediaProcessingError(
        'Missing required parameters',
        'INVALID_PARAMETERS',
        { fileId, fileType, messageId },
        false
      );
    }

    console.log('Processing media file:', {
      file_id: fileId,
      file_type: fileType,
      message_id: messageId,
      correlation_id: correlationId
    });

    // Get file from Telegram
    const fileInfo = await withRetry(
      async () => {
        const response = await fetch(
          `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
        );
        if (!response.ok) {
          throw new MediaProcessingError(
            'Failed to get file info from Telegram',
            'TELEGRAM_API_ERROR',
            { status: response.status }
          );
        }
        return response.json();
      },
      'get_file_info',
      messageId,
      correlationId,
      supabase
    );

    if (!fileInfo.ok || !fileInfo.result.file_path) {
      throw new MediaProcessingError(
        'Invalid file info from Telegram',
        'INVALID_FILE_INFO',
        fileInfo,
        false
      );
    }

    // Download file
    const fileBuffer = await withRetry(
      async () => {
        const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${fileInfo.result.file_path}`;
        const fileResponse = await fetch(downloadUrl);
        if (!fileResponse.ok) {
          throw new MediaProcessingError(
            'Failed to download file from Telegram',
            'DOWNLOAD_ERROR',
            { status: fileResponse.status }
          );
        }
        return fileResponse.arrayBuffer();
      },
      'download_file',
      messageId,
      correlationId,
      supabase
    );

    // Upload to storage
    const { publicUrl, storagePath } = await withRetry(
      async () => uploadMediaToStorage(
        supabase,
        fileBuffer,
        fileUniqueId,
        fileType
      ),
      'upload_to_storage',
      messageId,
      correlationId,
      supabase
    );

    // Update database records
    await withRetry(
      async () => {
        const { data: message } = await supabase
          .from('messages')
          .select('message_media_data')
          .eq('id', messageId)
          .single();

        if (!message) {
          throw new MediaProcessingError(
            'Message not found',
            'NOT_FOUND',
            { messageId },
            false
          );
        }

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

        await supabase.rpc('update_media_records', {
          p_message_id: messageId,
          p_public_url: publicUrl,
          p_storage_path: storagePath,
          p_message_media_data: updatedMessageMediaData
        });
      },
      'update_records',
      messageId,
      correlationId,
      supabase
    );

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
    
    const errorResponse = {
      error: error instanceof MediaProcessingError 
        ? error.message 
        : 'An unexpected error occurred',
      code: error instanceof MediaProcessingError ? error.code : 'UNKNOWN_ERROR',
      details: error instanceof MediaProcessingError ? error.details : undefined
    };

    return new Response(
      JSON.stringify(errorResponse),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 500 
      }
    );
  }
});