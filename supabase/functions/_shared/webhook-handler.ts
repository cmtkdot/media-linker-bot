import { corsHeaders } from './cors.ts';
import { validateWebhookUpdate } from './webhook-validator.ts';
import { handleProcessingError } from './error-handler.ts';
import { createMessage, processMedia } from './database-service.ts';
import { analyzeCaptionWithAI } from './caption-analyzer.ts';
import { TelegramWebhookUpdate } from './webhook-types.ts';

export async function handleWebhookUpdate(
  update: TelegramWebhookUpdate,
  supabase: any,
  botToken: string
) {
  const message = update.message || update.channel_post;
  
  if (!validateWebhookUpdate(update)) {
    return { message: 'Invalid or non-media message, skipping' };
  }

  console.log('[Webhook] Processing update:', {
    update_id: update.update_id,
    message_id: message.message_id,
    chat_id: message.chat.id,
    media_group_id: message.media_group_id
  });

  try {
    // If it's a media group, wait a bit for all messages to arrive
    if (message.media_group_id) {
      console.log('[Media Group] Waiting for completion:', message.media_group_id);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Analyze caption if present
    let productInfo = null;
    if (message.caption) {
      try {
        productInfo = await analyzeCaptionWithAI(
          message.caption,
          Deno.env.get('SUPABASE_URL') || '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        );
        console.log('[Caption Analysis] Complete:', productInfo);
      } catch (error) {
        console.error('[Caption Analysis] Error:', error);
      }
    }

    // First, handle the message record
    const { data: existingMessage, error: fetchError } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', message.chat.id)
      .eq('message_id', message.message_id)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    // Create or update message record
    let messageRecord;
    if (existingMessage) {
      const { data, error: updateError } = await supabase
        .from('messages')
        .update({
          caption: message.caption,
          ...(productInfo && {
            product_name: productInfo.product_name,
            product_code: productInfo.product_code,
            quantity: productInfo.quantity,
            vendor_uid: productInfo.vendor_uid,
            purchase_date: productInfo.purchase_date,
            notes: productInfo.notes,
            analyzed_content: productInfo
          }),
          updated_at: new Date().toISOString()
        })
        .eq('id', existingMessage.id)
        .select()
        .single();

      if (updateError) throw updateError;
      messageRecord = data;
      console.log('[Message] Updated:', messageRecord.id);
    } else {
      messageRecord = await createMessage(supabase, message, productInfo);
      console.log('[Message] Created:', messageRecord.id);
    }

    // If this is part of a media group, sync captions across the group
    if (message.media_group_id) {
      console.log('[Media Group] Syncing group messages:', message.media_group_id);
      const { error: groupSyncError } = await supabase
        .from('messages')
        .update({
          caption: message.caption,
          ...(productInfo && {
            product_name: productInfo.product_name,
            product_code: productInfo.product_code,
            quantity: productInfo.quantity,
            vendor_uid: productInfo.vendor_uid,
            purchase_date: productInfo.purchase_date,
            notes: productInfo.notes,
            analyzed_content: productInfo
          }),
          updated_at: new Date().toISOString()
        })
        .eq('media_group_id', message.media_group_id);

      if (groupSyncError) {
        console.error('[Media Group] Error syncing messages:', groupSyncError);
      }
    }

    // Now process the media
    const mediaResult = await processMedia(
      supabase,
      message,
      messageRecord,
      botToken,
      productInfo
    );

    console.log('[Webhook] Complete:', {
      update_id: update.update_id,
      message_id: message.message_id,
      media_result: mediaResult?.id
    });

    return { 
      success: true,
      messageId: messageRecord.id,
      mediaResult
    };

  } catch (error) {
    console.error('[Webhook] Error:', {
      error: error.message,
      stack: error.stack,
      update_id: update.update_id,
      message_id: message?.message_id
    });

    await handleProcessingError(
      supabase,
      error,
      { message_id: message?.message_id, chat_id: message?.chat?.id },
      0,
      true
    );

    return {
      success: false,
      error: error.message
    };
  }
}