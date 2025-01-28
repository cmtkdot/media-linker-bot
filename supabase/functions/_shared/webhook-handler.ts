import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { analyzeCaptionWithAI } from './caption-analyzer.ts';
import { withDatabaseRetry } from './database-retry.ts';

export async function handleWebhookUpdate(
  update: any, 
  supabase: any, 
  botToken: string,
  correlationId: string
) {
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
      has_caption: !!message.caption,
      correlation_id: correlationId
    });

    // Generate message URL
    const chatId = message.chat.id.toString();
    const messageUrl = `https://t.me/c/${chatId.substring(4)}/${message.message_id}`;

    // Handle caption and media group logic
    let isOriginalCaption = false;
    let originalMessageId = null;
    let analyzedContent = null;

    if (message.media_group_id && message.caption) {
      const { data: existingHolder } = await supabase
        .from('messages')
        .select('id')
        .eq('media_group_id', message.media_group_id)
        .eq('is_original_caption', true)
        .maybeSingle();

      isOriginalCaption = !existingHolder;
      originalMessageId = existingHolder?.id;
    } else if (message.caption) {
      isOriginalCaption = true;
    }

    if (message.caption && isOriginalCaption) {
      try {
        analyzedContent = await analyzeCaptionWithAI(message.caption);
        console.log('Caption analyzed:', { 
          message_id: message.message_id,
          correlation_id: correlationId,
          analyzed_content: analyzedContent
        });
      } catch (error) {
        console.error('Error analyzing caption:', error);
      }
    }

    // Create message media data structure
    const messageMediaData = {
      message: {
        url: messageUrl,
        media_group_id: message.media_group_id,
        caption: message.caption,
        message_id: message.message_id,
        chat_id: message.chat.id,
        date: message.date
      },
      sender: {
        sender_info: message.from || message.sender_chat || {},
        chat_info: message.chat || {}
      },
      analysis: {
        analyzed_content: analyzedContent,
        product_name: analyzedContent?.extracted_data?.product_name,
        product_code: analyzedContent?.extracted_data?.product_code,
        quantity: analyzedContent?.extracted_data?.quantity,
        vendor_uid: analyzedContent?.extracted_data?.vendor_uid,
        purchase_date: analyzedContent?.extracted_data?.purchase_date,
        notes: analyzedContent?.extracted_data?.notes
      },
      meta: {
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'pending',
        error: null,
        correlation_id: correlationId,
        is_original_caption: isOriginalCaption,
        original_message_id: originalMessageId
      }
    };

    // Create or update message record
    const messageData = {
      message_id: message.message_id,
      chat_id: message.chat.id,
      sender_info: message.from || message.sender_chat || {},
      message_type: determineMessageType(message),
      telegram_data: message,
      media_group_id: message.media_group_id,
      message_url: messageUrl,
      correlation_id: correlationId,
      is_original_caption: isOriginalCaption,
      original_message_id: originalMessageId,
      message_media_data: messageMediaData,
      analyzed_content: analyzedContent,
      status: 'pending'
    };

    const { data: messageRecord, error: messageError } = await withDatabaseRetry(async () => {
      return await supabase
        .from('messages')
        .upsert(messageData)
        .select()
        .single();
    });

    if (messageError) throw messageError;

    console.log('Message record created/updated:', {
      message_id: messageRecord.id,
      correlation_id: correlationId,
      is_original_caption: isOriginalCaption
    });

    return {
      success: true,
      message: 'Update processed successfully',
      messageId: messageRecord.id,
      correlationId,
      isOriginalCaption
    };

  } catch (error) {
    console.error('Error in webhook handler:', error);
    throw error;
  }
}

function determineMessageType(message: any): string {
  if (message.photo && message.photo.length > 0) return 'photo';
  if (message.video) return 'video';
  if (message.document) return 'document';
  if (message.animation) return 'animation';
  return 'unknown';
}