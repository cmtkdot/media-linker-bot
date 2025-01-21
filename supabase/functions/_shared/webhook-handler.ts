import { TelegramUpdate } from './telegram-types.ts';
import { analyzeCaptionWithAI } from './caption-analyzer.ts';
import { handleMessageProcessing } from './message-manager.ts';
import { processMedia } from './media-handler.ts';
import { cleanupFailedRecords } from './cleanup-manager.ts';

export async function handleWebhookUpdate(
  update: TelegramUpdate,
  supabase: any,
  botToken: string
) {
  const message = update.message || update.channel_post;
  if (!message) {
    console.log('No message in update');
    return { message: 'No message in update' };
  }

  const hasMedia = message.photo || message.video || message.document || message.animation;
  if (!hasMedia) {
    console.log('Not a media message, skipping');
    return { message: 'Not a media message, skipping' };
  }

  console.log('Processing message:', {
    message_id: message.message_id,
    chat_id: message.chat.id,
    media_type: message.photo ? 'photo' : 
                message.video ? 'video' : 
                message.document ? 'document' : 
                message.animation ? 'animation' : 'unknown'
  });

  try {
    // Step 1: Analyze caption if present
    let productInfo = null;
    if (message.caption) {
      try {
        productInfo = await analyzeCaptionWithAI(
          message.caption,
          Deno.env.get('SUPABASE_URL') || '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        );
        console.log('Caption analysis result:', productInfo);
      } catch (error) {
        console.error('Error analyzing caption:', error);
      }
    }

    // Step 2: Process message and create record
    const { messageRecord, retryCount } = await handleMessageProcessing(
      supabase,
      message,
      null, // No existing message for new updates
      productInfo
    );

    if (!messageRecord) {
      throw new Error('Failed to create message record');
    }

    // Step 3: Process media with gathered data
    const result = await processMedia(
      supabase,
      message,
      messageRecord,
      botToken,
      productInfo,
      retryCount
    );

    // Step 4: Update message status on success
    const { error: statusError } = await supabase
      .from('messages')
      .update({
        status: 'success',
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        analyzed_content: productInfo
      })
      .eq('id', messageRecord.id);

    if (statusError) {
      console.error('Error updating message status:', statusError);
      throw statusError;
    }

    // Step 5: Clean up old failed records
    await cleanupFailedRecords(supabase);

    console.log('Successfully processed update:', {
      update_id: update.update_id,
      message_id: message.message_id,
      chat_id: message.chat.id,
      result
    });

    return { 
      message: 'Media processed successfully', 
      messageId: messageRecord.id, 
      ...result 
    };

  } catch (error) {
    console.error('Error in handleWebhookUpdate:', {
      error: error.message,
      stack: error.stack,
      update_id: update.update_id,
      message_id: message?.message_id || 'undefined',
      chat_id: message?.chat?.id || 'undefined'
    });

    throw error;
  }
}