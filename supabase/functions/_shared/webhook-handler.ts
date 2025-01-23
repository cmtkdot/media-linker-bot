import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from "../_shared/cors.ts";
import { processMediaFiles } from "../_shared/media-processor.ts";
import { delay } from "../_shared/retry-utils.ts";
import { analyzeCaptionWithAI } from "../_shared/caption-analyzer.ts";

export async function handleWebhookUpdate(update: any, supabase: any, botToken: string) {
  const message = update.message || update.channel_post;
  if (!message) {
    console.log('No message in update');
    return { message: 'No message in update' };
  }

  try {
    console.log('Processing webhook update:', {
      update_id: update.update_id,
      message_id: message.message_id,
      chat_id: message.chat.id,
      media_group_id: message.media_group_id,
      has_caption: !!message.caption
    });

    // Handle video thumbnail if present
    let thumbnailUrl = null;
    if (message.video?.thumb) {
      console.log('Video thumbnail found:', message.video.thumb);
      const { data: storageData } = await supabase.storage
        .from('media')
        .list('', {
          search: message.video.thumb.file_unique_id
        });

      if (!storageData || storageData.length === 0) {
        // Download and store thumbnail if it doesn't exist
        const response = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${message.video.thumb.file_id}`);
        const fileData = await response.json();
        
        if (fileData.ok) {
          const fileUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
          const thumbResponse = await fetch(fileUrl);
          const thumbBuffer = await thumbResponse.arrayBuffer();
          
          const fileName = `${message.video.thumb.file_unique_id}.jpg`;
          const { error: uploadError } = await supabase.storage
            .from('media')
            .upload(fileName, thumbBuffer, {
              contentType: 'image/jpeg',
              upsert: true
            });

          if (!uploadError) {
            const { data: { publicUrl } } = await supabase.storage
              .from('media')
              .getPublicUrl(fileName);
            thumbnailUrl = publicUrl;
          }
        }
      } else {
        const { data: { publicUrl } } = await supabase.storage
          .from('media')
          .getPublicUrl(storageData[0].name);
        thumbnailUrl = publicUrl;
      }
    }

    // Analyze caption if present
    let analyzedContent = null;
    if (message.caption) {
      try {
        console.log('Analyzing caption:', message.caption);
        analyzedContent = await analyzeCaptionWithAI(
          message.caption,
          Deno.env.get('SUPABASE_URL') || '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        );
        console.log('Caption analysis result:', analyzedContent);
      } catch (error) {
        console.error('Error analyzing caption:', error);
      }
    }

    // Prepare message data
    const messageData = {
      ...message,
      analyzed_content: analyzedContent,
      product_name: analyzedContent?.product_name || null,
      product_code: analyzedContent?.product_code || null,
      quantity: analyzedContent?.quantity || null,
      vendor_uid: analyzedContent?.vendor_uid || null,
      purchase_date: analyzedContent?.purchase_date || null,
      notes: analyzedContent?.notes || null,
      thumbnail_url: thumbnailUrl
    };

    // Insert or update message record
    const { data: existingMessage } = await supabase
      .from('messages')
      .select('*')
      .eq('message_id', message.message_id)
      .eq('chat_id', message.chat.id)
      .maybeSingle();

    if (existingMessage) {
      const { error: updateError } = await supabase
        .from('messages')
        .update({
          caption: message.caption,
          analyzed_content: analyzedContent,
          product_name: messageData.product_name,
          product_code: messageData.product_code,
          quantity: messageData.quantity,
          vendor_uid: messageData.vendor_uid,
          purchase_date: messageData.purchase_date,
          notes: messageData.notes,
          thumbnail_url: thumbnailUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingMessage.id);

      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from('messages')
        .insert([messageData]);

      if (insertError) throw insertError;
    }

    await delay(1000);

    // Get the message record
    const { data: messageRecord, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('message_id', message.message_id)
      .eq('chat_id', message.chat.id)
      .maybeSingle();

    if (messageError) throw messageError;
    if (!messageRecord) throw new Error('Message record not found after creation');

    // Process media files
    const hasMedia = message.photo || message.video || message.document || message.animation;
    if (hasMedia) {
      await processMediaFiles(messageData, messageRecord, supabase, botToken);
    }

    console.log('Successfully processed update:', {
      update_id: update.update_id,
      message_id: message.message_id,
      chat_id: message.chat.id,
      record_id: messageRecord.id
    });

    return {
      success: true,
      message: 'Update processed successfully',
      messageId: messageRecord.id
    };

  } catch (error) {
    console.error('Error in webhook handler:', {
      error: error.message,
      stack: error.stack,
      update_id: update.update_id,
      message_id: message?.message_id,
      chat_id: message?.chat?.id
    });
    throw error;
  }
}