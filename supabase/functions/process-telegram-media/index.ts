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
    const { messageId } = await req.json();
    
    if (!messageId) {
      throw new Error('Message ID is required');
    }

    console.log('Processing message:', messageId);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get message data
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .maybeSingle();

    if (messageError) throw messageError;
    if (!message) throw new Error('Message not found');

    console.log('Retrieved message data:', {
      id: message.id,
      media_group_id: message.media_group_id,
      has_media_data: !!message.message_media_data,
      status: message.status
    });

    // Extract media data from message_media_data
    const mediaData = message.message_media_data?.media;
    const fileId = mediaData?.file_id;
    
    if (!fileId) {
      throw new Error('No media data found in message');
    }

    // Check for existing media with same file_id
    const { data: existingMedia } = await supabase
      .from('telegram_media')
      .select('*')
      .eq('file_id', fileId)
      .maybeSingle();

    if (existingMedia) {
      console.log('Found existing media:', existingMedia.id);
      
      // Update message with existing media data
      const updatedMessageMediaData = {
        ...message.message_media_data,
        media: {
          ...message.message_media_data.media,
          public_url: existingMedia.public_url,
          storage_path: existingMedia.storage_path
        },
        meta: {
          ...message.message_media_data.meta,
          status: 'processed',
          processed_at: new Date().toISOString()
        }
      };

      const { error: updateError } = await supabase
        .from('messages')
        .update({
          message_media_data: updatedMessageMediaData,
          status: 'processed',
          processed_at: new Date().toISOString()
        })
        .eq('id', messageId);

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({ 
          message: 'Message updated with existing media',
          mediaId: existingMedia.id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create new telegram_media record
    const { data: newMedia, error: insertError } = await supabase
      .from('telegram_media')
      .insert({
        message_id: message.id,
        file_id: mediaData.file_id,
        file_unique_id: mediaData.file_unique_id,
        file_type: mediaData.file_type,
        public_url: mediaData.public_url,
        storage_path: mediaData.storage_path,
        message_media_data: message.message_media_data,
        correlation_id: message.correlation_id,
        telegram_data: message.telegram_data,
        is_original_caption: message.is_original_caption,
        original_message_id: message.original_message_id,
        processed: message.message_media_data.meta?.status === 'processed',
        media_group_id: message.media_group_id,
        caption: message.caption,
        analyzed_content: message.analyzed_content,
        product_name: message.message_media_data?.analysis?.product_name,
        product_code: message.message_media_data?.analysis?.product_code,
        quantity: message.message_media_data?.analysis?.quantity,
        vendor_uid: message.message_media_data?.analysis?.vendor_uid,
        purchase_date: message.message_media_data?.analysis?.purchase_date,
        notes: message.message_media_data?.analysis?.notes,
        mime_type: mediaData.mime_type,
        width: mediaData.width,
        height: mediaData.height,
        duration: mediaData.duration,
        file_size: mediaData.file_size,
        status: message.message_media_data?.meta?.status || 'pending'
      })
      .select()
      .single();

    if (insertError) throw insertError;

    console.log('Created new media record:', newMedia.id);

    return new Response(
      JSON.stringify({ 
        message: 'Media processed successfully',
        mediaId: newMedia.id
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