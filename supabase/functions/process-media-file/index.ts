import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messageId, botToken, correlationId } = await req.json();

    if (!messageId || !botToken) {
      throw new Error('Missing required parameters');
    }

    console.log('Processing request:', { messageId, correlationId });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get message data with message_media_data
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('*, message_media_data')
      .eq('id', messageId)
      .maybeSingle();

    if (messageError) throw messageError;
    if (!message) throw new Error('Message not found');

    // Check if message has media data
    if (!message.message_media_data?.media?.file_id) {
      throw new Error('No media data found in message');
    }

    // Get file from Telegram
    const fileId = message.message_media_data.media.file_id;
    console.log('Getting file info from Telegram:', fileId);

    const fileResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
    );

    if (!fileResponse.ok) {
      throw new Error(`Failed to get file info: ${fileResponse.statusText}`);
    }

    const fileData = await fileResponse.json();
    if (!fileData.ok || !fileData.result.file_path) {
      throw new Error('Failed to get file path from Telegram');
    }

    // Download file
    const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
    const fileDownload = await fetch(downloadUrl);
    if (!fileDownload.ok) {
      throw new Error(`Failed to download file: ${fileDownload.statusText}`);
    }

    const fileBuffer = await fileDownload.arrayBuffer();
    const fileName = `${message.message_media_data.media.file_unique_id}.${fileData.result.file_path.split('.').pop()}`;

    console.log('Uploading file to storage:', fileName);

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(fileName, fileBuffer, {
        contentType: fileDownload.headers.get('content-type') || 'application/octet-stream',
        upsert: true
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: { publicUrl } } = await supabase.storage
      .from('media')
      .getPublicUrl(fileName);

    console.log('File uploaded successfully:', { publicUrl, fileName });

    // Update message_media_data with storage info
    const updatedMediaData = {
      ...message.message_media_data,
      media: {
        ...message.message_media_data.media,
        public_url: publicUrl,
        storage_path: fileName
      },
      meta: {
        ...message.message_media_data.meta,
        status: 'processed',
        processed_at: new Date().toISOString()
      }
    };

    // Update message status and media data
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString(),
        message_media_data: updatedMediaData
      })
      .eq('id', messageId);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ 
        message: 'Media processing completed successfully',
        messageId,
        correlationId,
        publicUrl,
        fileName
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing media:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
        details: error
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});