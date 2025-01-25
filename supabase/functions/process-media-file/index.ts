import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getMimeType } from "../_shared/media-validators.ts";
import { getAndDownloadTelegramFile } from "../_shared/telegram-service.ts";
import { withDatabaseRetry } from "../_shared/database-retry.ts";

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

    if (!fileId || !fileUniqueId || !fileType || !botToken) {
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
      .select('id, public_url')
      .eq('file_unique_id', fileUniqueId)
      .maybeSingle();

    if (existingMedia?.public_url) {
      console.log('Media already exists:', existingMedia);
      return new Response(
        JSON.stringify(existingMedia),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Download and process the file
    const { buffer, filePath } = await getAndDownloadTelegramFile(fileId, botToken);
    const fileExt = filePath.split('.').pop() || '';
    const fileName = `${fileUniqueId}.${fileExt}`;

    console.log('Uploading file to storage:', {
      fileName,
      fileType,
      mimeType: getMimeType(filePath)
    });

    // Upload to storage with retry
    const { error: uploadError } = await withDatabaseRetry(
      async () => {
        return await supabase.storage
          .from('media')
          .upload(fileName, buffer, {
            contentType: getMimeType(filePath),
            upsert: true,
            cacheControl: '3600'
          });
      },
      0,
      `upload_file_${fileName}`
    );

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: { publicUrl } } = await supabase.storage
      .from('media')
      .getPublicUrl(fileName);

    // Update media record with public URL
    const { data: mediaRecord, error: updateError } = await withDatabaseRetry(
      async () => {
        return await supabase
          .from('telegram_media')
          .update({ 
            public_url: publicUrl,
            processed: true,
            updated_at: new Date().toISOString()
          })
          .eq('file_unique_id', fileUniqueId)
          .select()
          .single();
      },
      0,
      `update_media_record_${fileUniqueId}`
    );

    if (updateError) throw updateError;

    console.log('Successfully processed media file:', {
      file_id: fileId,
      public_url: publicUrl,
      record_id: mediaRecord.id
    });

    return new Response(
      JSON.stringify(mediaRecord),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing media file:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});