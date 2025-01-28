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

    const chatId = message.chat.id.toString();
    const messageUrl = `https://t.me/c/${chatId.substring(4)}/${message.message_id}`;

    let isOriginalCaption = false;
    let originalMessageId = null;
    let analyzedContent = null;

    // Handle media group caption logic
    if (message.media_group_id) {
      const { data: existingMessages } = await supabase
        .from('messages')
        .select('id, is_original_caption, analyzed_content, caption')
        .eq('media_group_id', message.media_group_id)
        .order('created_at', { ascending: true });

      if (message.caption) {
        // If this is the first message with caption in the group
        const existingCaptionHolder = existingMessages?.find(m => m.is_original_caption);
        if (!existingCaptionHolder) {
          isOriginalCaption = true;
          analyzedContent = await analyzeCaptionWithAI(message.caption);
          
          // Update all existing messages in the group with the analyzed content
          if (existingMessages?.length > 0) {
            await supabase
              .from('messages')
              .update({
                analyzed_content: analyzedContent,
                original_message_id: null // Will be updated after current message insert
              })
              .eq('media_group_id', message.media_group_id);
          }
        } else {
          originalMessageId = existingCaptionHolder.id;
          analyzedContent = existingCaptionHolder.analyzed_content;
        }
      } else if (existingMessages?.length > 0) {
        // For non-caption messages in group, use existing analyzed content
        const existingCaptionHolder = existingMessages.find(m => m.is_original_caption);
        if (existingCaptionHolder) {
          originalMessageId = existingCaptionHolder.id;
          analyzedContent = existingCaptionHolder.analyzed_content;
        }
      }
    } else if (message.caption) {
      isOriginalCaption = true;
      analyzedContent = await analyzeCaptionWithAI(message.caption);
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
        original_message_id: originalMessageId,
        retry_count: 0
      }
    };

    // Create message record
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
      status: 'pending',
      caption: message.caption
    };

    // Insert/update message record
    const { data: messageRecord, error: messageError } = await withDatabaseRetry(async () => {
      return await supabase
        .from('messages')
        .upsert(messageData)
        .select()
        .single();
    });

    if (messageError) throw messageError;

    // If this is part of a media group and has analyzed content, sync it
    if (message.media_group_id && analyzedContent) {
      if (isOriginalCaption) {
        // Update all messages in the group to point to this message as original
        await supabase
          .from('messages')
          .update({
            analyzed_content: analyzedContent,
            original_message_id: messageRecord.id,
            is_original_caption: false
          })
          .eq('media_group_id', message.media_group_id)
          .neq('id', messageRecord.id);
      }
    }

    // Queue for processing
    const { error: queueError } = await supabase
      .from('unified_processing_queue')
      .insert({
        queue_type: message.media_group_id ? 'media_group' : 'media',
        data: messageMediaData,
        status: 'pending',
        correlation_id: correlationId,
        chat_id: message.chat.id,
        message_id: message.message_id,
        message_media_data: messageMediaData
      });

    if (queueError) throw queueError;

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