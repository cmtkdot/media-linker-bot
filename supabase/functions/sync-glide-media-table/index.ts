import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { withDatabaseRetry } from "../_shared/database-retry.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // First, get all messages that need syncing
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .in('message_type', ['photo', 'video', 'document', 'animation'])
      .is('processed_at', null);

    if (messagesError) throw messagesError;

    let syncedCount = 0;
    let errorCount = 0;
    const errors = [];

    // Process each message
    for (const message of messages || []) {
      try {
        const fileData = {
          file_id: message.message_data?.photo?.[0]?.file_id || 
                   message.message_data?.video?.file_id ||
                   message.message_data?.document?.file_id ||
                   message.message_data?.animation?.file_id,
          file_unique_id: message.message_data?.photo?.[0]?.file_unique_id ||
                         message.message_data?.video?.file_unique_id ||
                         message.message_data?.document?.file_unique_id ||
                         message.message_data?.animation?.file_unique_id,
          file_type: message.message_type
        };

        if (!fileData.file_unique_id) {
          console.error('Missing file_unique_id for message:', message.id);
          continue;
        }

        // Check if media already exists
        const { data: existingMedia } = await supabase
          .from('telegram_media')
          .select('id')
          .eq('file_unique_id', fileData.file_unique_id)
          .maybeSingle();

        if (existingMedia) {
          // Update existing record
          const { error: updateError } = await supabase
            .from('telegram_media')
            .update({
              message_id: message.id,
              caption: message.caption,
              product_name: message.product_name,
              product_code: message.product_code,
              quantity: message.quantity,
              vendor_uid: message.vendor_uid,
              purchase_date: message.purchase_date,
              notes: message.notes,
              analyzed_content: message.analyzed_content,
              telegram_data: {
                message_data: message.message_data,
                media_group_id: message.media_group_id
              },
              updated_at: new Date().toISOString()
            })
            .eq('id', existingMedia.id);

          if (updateError) throw updateError;
        } else {
          // Insert new record
          const { error: insertError } = await supabase
            .from('telegram_media')
            .insert({
              message_id: message.id,
              file_id: fileData.file_id,
              file_unique_id: fileData.file_unique_id,
              file_type: fileData.file_type,
              caption: message.caption,
              product_name: message.product_name,
              product_code: message.product_code,
              quantity: message.quantity,
              vendor_uid: message.vendor_uid,
              purchase_date: message.purchase_date,
              notes: message.notes,
              analyzed_content: message.analyzed_content,
              telegram_data: {
                message_data: message.message_data,
                media_group_id: message.media_group_id
              }
            });

          if (insertError) throw insertError;
        }

        // Mark message as processed
        await supabase
          .from('messages')
          .update({ processed_at: new Date().toISOString() })
          .eq('id', message.id);

        syncedCount++;
      } catch (error) {
        console.error('Error processing message:', message.id, error);
        errorCount++;
        errors.push({
          message_id: message.id,
          error: error.message,
          file_unique_id: message.message_data?.photo?.[0]?.file_unique_id ||
                         message.message_data?.video?.file_unique_id ||
                         message.message_data?.document?.file_unique_id ||
                         message.message_data?.animation?.file_unique_id
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced_count: syncedCount,
        error_count: errorCount,
        errors
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    console.error('Error in sync function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400
      }
    );
  }
});