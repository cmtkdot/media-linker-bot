import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { TelegramUpdate } from './telegram-types.ts';
import { analyzeCaption } from './telegram-service.ts';
import { createMessage } from './database-service.ts';
import { processMediaFile } from './media-processor.ts';
import { MAX_RETRY_ATTEMPTS, INITIAL_RETRY_DELAY, MAX_BACKOFF_DELAY } from './constants.ts';

function calculateBackoffDelay(retryCount: number): number {
  return Math.min(INITIAL_RETRY_DELAY * Math.pow(2, retryCount), MAX_BACKOFF_DELAY);
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function updateExistingMedia(supabase: any, mediaFile: any, message: any, messageRecord: any) {
  console.log('Updating existing media record for file_unique_id:', mediaFile.file_unique_id);
  
  // Get existing media record
  const { data: existingMedia } = await supabase
    .from('telegram_media')
    .select('*')
    .eq('file_unique_id', mediaFile.file_unique_id)
    .single();

  if (!existingMedia) {
    throw new Error('Existing media record not found');
  }

  // Prepare telegram data with updated message info
  const telegramData = {
    ...existingMedia.telegram_data,
    message_id: message.message_id,
    chat_id: message.chat.id,
    sender_chat: message.sender_chat,
    chat: message.chat,
    date: message.date,
    caption: message.caption,
    media_group_id: message.media_group_id,
  };

  // Update telegram_media record
  const { error: mediaError } = await supabase
    .from('telegram_media')
    .update({
      telegram_data: telegramData,
      caption: message.caption,
      updated_at: new Date().toISOString()
    })
    .eq('id', existingMedia.id);

  if (mediaError) {
    console.error('Error updating telegram_media:', mediaError);
    throw mediaError;
  }

  // Update message record
  const { error: messageError } = await supabase
    .from('messages')
    .update({
      message_data: message,
      updated_at: new Date().toISOString(),
      status: 'success',
      processed_at: new Date().toISOString()
    })
    .eq('id', messageRecord.id);

  if (messageError) {
    console.error('Error updating message:', messageError);
    throw messageError;
  }

  return existingMedia;
}

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

  // Check for existing message
  const { data: existingMessage, error: fetchError } = await supabase
    .from('messages')
    .select('*')
    .eq('chat_id', message.chat.id)
    .eq('message_id', message.message_id)
    .maybeSingle();

  if (fetchError) {
    console.error('Error checking for existing message:', fetchError);
    throw fetchError;
  }

  let messageRecord = existingMessage;
  let retryCount = existingMessage?.retry_count || 0;

  // Create new message record if it doesn't exist
  if (!existingMessage) {
    try {
      let productInfo = null;
      if (message.caption) {
        console.log('Analyzing caption:', message.caption);
        productInfo = await analyzeCaption(
          message.caption,
          Deno.env.get('SUPABASE_URL') || '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        );
      }
      messageRecord = await createMessage(supabase, message, productInfo);
      console.log('Created new message record:', messageRecord);
    } catch (error) {
      console.error('Error creating message:', error);
      throw error;
    }
  }

  // Update existing message status to processing
  if (existingMessage) {
    const { data: updatedMessage, error: updateError } = await supabase
      .from('messages')
      .update({
        status: 'processing',
        retry_count: retryCount,
        last_retry_at: new Date().toISOString(),
      })
      .eq('id', existingMessage.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating message status:', updateError);
      throw updateError;
    }
    messageRecord = updatedMessage;
  }

  while (retryCount < MAX_RETRY_ATTEMPTS) {
    try {
      const mediaTypes = ['photo', 'video', 'document', 'animation'] as const;
      let mediaFile = null;
      let mediaType = '';

      for (const type of mediaTypes) {
        if (message[type]) {
          mediaFile = type === 'photo' 
            ? message[type]![message[type]!.length - 1] 
            : message[type];
          mediaType = type;
          break;
        }
      }

      if (!mediaFile) {
        throw new Error('No media file found in message');
      }

      // Check for existing media with same file_unique_id
      const { data: existingMedia } = await supabase
        .from('telegram_media')
        .select('*')
        .eq('file_unique_id', mediaFile.file_unique_id)
        .single();

      let result;
      if (existingMedia) {
        console.log('Found existing media, updating records without re-upload');
        result = await updateExistingMedia(supabase, mediaFile, message, messageRecord);
      } else {
        console.log('Processing new media file');
        result = await processMediaFile(
          supabase,
          mediaFile,
          mediaType,
          message,
          messageRecord,
          botToken,
          messageRecord.product_info
        );
      }

      // Update message status to success
      await supabase
        .from('messages')
        .update({
          status: 'success',
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', messageRecord.id);

      // Handle media group updates
      if (message.media_group_id) {
        console.log('Processing media group:', message.media_group_id);
        await supabase
          .from('telegram_media')
          .update({ 
            caption: message.caption,
            product_name: messageRecord.product_name,
            product_code: messageRecord.product_code,
            quantity: messageRecord.quantity
          })
          .eq('telegram_data->media_group_id', message.media_group_id);
      }

      return { 
        message: 'Media processed successfully', 
        messageId: messageRecord.id, 
        ...result 
      };

    } catch (error) {
      console.error(`Attempt ${retryCount + 1} failed:`, error);
      retryCount++;

      // Update message with retry information
      const { error: updateError } = await supabase
        .from('messages')
        .update({
          retry_count: retryCount,
          last_retry_at: new Date().toISOString(),
          status: retryCount >= MAX_RETRY_ATTEMPTS ? 'failed' : 'pending',
          processing_error: error.message,
          updated_at: new Date().toISOString()
        })
        .eq('id', messageRecord.id);

      if (updateError) {
        console.error('Error updating retry information:', updateError);
        throw updateError;
      }

      if (error.message?.includes('Too Many Requests') || error.code === 429) {
        const backoffDelay = calculateBackoffDelay(retryCount);
        console.log(`Rate limited. Waiting ${backoffDelay}ms before retry...`);
        await delay(backoffDelay);
      } else if (retryCount < MAX_RETRY_ATTEMPTS) {
        await delay(1000); // Small delay for non-rate-limit errors
      }

      if (retryCount >= MAX_RETRY_ATTEMPTS) {
        console.error('Max retry attempts reached. Giving up.');
        throw new Error(`Failed after ${MAX_RETRY_ATTEMPTS} attempts. Last error: ${error.message}`);
      }
    }
  }

  throw new Error(`Processing failed after ${MAX_RETRY_ATTEMPTS} attempts`);
}