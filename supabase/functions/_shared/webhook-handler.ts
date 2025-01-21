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
  const { data: existingMessage } = await supabase
    .from('messages')
    .select('id')
    .eq('chat_id', message.chat.id)
    .eq('message_id', message.message_id)
    .maybeSingle();

  if (existingMessage) {
    console.log('Message already processed:', existingMessage);
    return { message: 'Message already processed' };
  }

  let retryCount = 0;
  let lastError = null;

  while (retryCount < MAX_RETRY_ATTEMPTS) {
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

      const messageRecord = await createMessage(supabase, message, productInfo);

      const mediaTypes = ['photo', 'video', 'document', 'animation'] as const;
      let mediaFile = null;
      let mediaType = '';

      for (const type of mediaTypes) {
        if (message[type]) {
          mediaFile = type === 'photo' 
            ? message[type]![message[type]!.length - 1] // Get the highest quality photo
            : message[type];
          mediaType = type;
          break;
        }
      }

      if (!mediaFile) {
        throw new Error('No media file found in message');
      }

      const result = await processMediaFile(
        supabase,
        mediaFile,
        mediaType,
        message,
        messageRecord,
        botToken,
        productInfo
      );

      // If this is part of a media group, update all related media with the same caption
      if (message.media_group_id) {
        console.log('Processing media group:', message.media_group_id);
        await supabase
          .from('telegram_media')
          .update({ 
            caption: message.caption,
            product_name: productInfo?.product_name,
            product_code: productInfo?.product_code,
            quantity: productInfo?.quantity
          })
          .eq('telegram_data->media_group_id', message.media_group_id);
      }

      // Update status to success in pending_webhook_updates
      await supabase
        .from('pending_webhook_updates')
        .update({
          status: 'success',
          updated_at: new Date().toISOString()
        })
        .eq('update_data->message->message_id', message.message_id)
        .eq('update_data->message->chat->id', message.chat.id);

      return { 
        message: 'Media processed successfully', 
        messageId: messageRecord.id, 
        ...result 
      };

    } catch (error) {
      console.error(`Attempt ${retryCount + 1} failed:`, error);
      lastError = error;

      // Check if it's a rate limit error
      if (error.message?.includes('Too Many Requests') || error.code === 429) {
        const backoffDelay = calculateBackoffDelay(retryCount);
        console.log(`Rate limited. Waiting ${backoffDelay}ms before retry...`);
        await delay(backoffDelay);
      }

      // Update retry count and status in pending_webhook_updates
      await supabase
        .from('pending_webhook_updates')
        .update({
          retry_count: retryCount + 1,
          error_message: error.message,
          status: retryCount + 1 >= MAX_RETRY_ATTEMPTS ? 'failed' : 'pending',
          last_retry_at: new Date().toISOString()
        })
        .eq('update_data->message->message_id', message.message_id)
        .eq('update_data->message->chat->id', message.chat.id);

      retryCount++;

      if (retryCount >= MAX_RETRY_ATTEMPTS) {
        console.error('Max retry attempts reached. Giving up.');
        throw new Error(`Failed after ${MAX_RETRY_ATTEMPTS} attempts. Last error: ${lastError.message}`);
      }

      // For non-rate-limit errors, add a small delay before retry
      if (!error.message?.includes('Too Many Requests') && error.code !== 429) {
        await delay(1000);
      }
    }
  }

  throw lastError;
}