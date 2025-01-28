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

    // Get file from Telegram
    const filePath = await getTelegramFilePath(fileId, botToken);
    const buffer = await downloadTelegramFile(filePath, botToken);

    // Generate storage path from file_unique_id and proper extension
    const fileExt = filePath.split('.').pop() || 'bin';
    const storagePath = `${fileUniqueId}.${fileExt}`;

    console.log('Uploading file to storage:', storagePath);
    
    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(storagePath, buffer, {
        contentType: fileType === 'photo' ? 'image/jpeg' : 'application/octet-stream',
        upsert: true,
        cacheControl: '3600'
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: { publicUrl } } = await supabase.storage
      .from('media')
      .getPublicUrl(storagePath);

    if (!publicUrl) {
      throw new Error('Failed to get public URL after upload');
    }

    // Update telegram_media with the new file information
    const { data: message } = await supabase
      .from('messages')
      .select('message_media_data, correlation_id')
      .eq('id', messageId)
      .single();

    if (!message) {
      throw new Error('Message not found');
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
      }
    };

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

    console.log('Successfully processed media file:', {
      file_id: fileId,
      public_url: publicUrl,
      storage_path: storagePath
    });

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
    
    // Log the error to our new media_processing_logs table
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

async function getTelegramFilePath(fileId: string, botToken: string): Promise<string> {
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

  return data.result.file_path;
}

async function downloadTelegramFile(filePath: string, botToken: string): Promise<ArrayBuffer> {
  const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
  const response = await fetch(downloadUrl);

  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }

  return await response.arrayBuffer();
}