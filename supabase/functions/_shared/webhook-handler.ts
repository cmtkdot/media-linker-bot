import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { processMediaFiles } from './media-processor.ts';
import { withDatabaseRetry } from './database-retry.ts';
import { analyzeCaptionWithAI } from './caption-analyzer.ts';

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

    // First check if message already exists
    const { data: existingMessage } = await supabase
      .from('messages')
      .select('*')
      .eq('message_id', message.message_id)
      .eq('chat_id', message.chat.id)
      .maybeSingle();

    if (existingMessage) {
      console.log('Message already exists:', {
        message_id: message.message_id,
        chat_id: message.chat.id
      });
      return {
        success: true,
        message: 'Message already processed',
        messageId: existingMessage.id
      };
    }

    // Generate message URL
    const chatId = message.chat.id.toString();
    const messageUrl = `https://t.me/c/${chatId.substring(4)}/${message.message_id}`;

    // Analyze caption if present
    let analyzedContent = null;
    if (message.caption) {
      try {
        console.log('Analyzing caption:', message.caption);
        analyzedContent = await analyzeCaptionWithAI(message.caption);
        console.log('Caption analysis result:', analyzedContent);
      } catch (error) {
        console.error('Error analyzing caption:', error);
      }
    }

    // Create message record with retry
    const messageRecord = await withDatabaseRetry(async () => {
      const messageData = {
        message_id: message.message_id,
        chat_id: message.chat.id,
        sender_info: message.from || message.sender_chat || {},
        message_type: determineMessageType(message),
        message_data: message,
        caption: message.caption,
        media_group_id: message.media_group_id,
        message_url: messageUrl,
        analyzed_content: analyzedContent,
        product_name: analyzedContent?.product_name || null,
        product_code: analyzedContent?.product_code || null,
        quantity: analyzedContent?.quantity || null,
        vendor_uid: analyzedContent?.vendor_uid || null,
        purchase_date: analyzedContent?.purchase_date || null,
        notes: analyzedContent?.notes || null,
        status: 'pending',
        retry_count: 0
      };

      const { data, error: insertError } = await supabase
        .from('messages')
        .insert([messageData])
        .select()
        .single();

      if (insertError) {
        console.error('Error inserting message:', insertError);
        throw insertError;
      }

      return data;
    }, 0, `create_message_${message.message_id}`);

    // Process media files if present
    const hasMedia = message.photo || message.video || message.document || message.animation;
    if (hasMedia && messageRecord) {
      console.log('Processing media for message:', messageRecord.id);
      await processMediaFiles(message, messageRecord, supabase, botToken);
    }

    console.log('Successfully processed update:', {
      update_id: update.update_id,
      message_id: message.message_id,
      chat_id: message.chat.id,
      record_id: messageRecord?.id
    });

    return {
      success: true,
      message: 'Update processed successfully',
      messageId: messageRecord?.id
    };

  } catch (error) {
    console.error('Error in webhook handler:', {
      error: error.message,
      stack: error.stack,
      update_id: update.update_id,
      message_id: message?.message_id,
      chat_id: message?.chat?.id
    });

    // Store failed webhook update for retry
    try {
      await supabase
        .from('failed_webhook_updates')
        .insert({
          message_id: message?.message_id,
          chat_id: message?.chat?.id,
          error_message: error.message,
          error_stack: error.stack,
          message_data: update,
          status: 'failed'
        });
    } catch (dbError) {
      console.error('Failed to store failed webhook update:', dbError);
    }

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