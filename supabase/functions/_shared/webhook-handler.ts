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

  // Check for existing message with same chat_id and message_id
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

  // If message exists and was processed successfully or failed, skip
  if (existingMessage?.status === 'success' || existingMessage?.status === 'failed') {
    console.log('Message already processed or failed:', existingMessage);
    return { message: 'Message already processed or failed', id: existingMessage.id };
  }

  let messageRecord = existingMessage;
  let retryCount = existingMessage?.retry_count || 0;

  // If no existing message, create new one
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

      const result = await processMediaFile(
        supabase,
        mediaFile,
        mediaType,
        message,
        messageRecord,
        botToken,
        messageRecord.product_info
      );

      // Update message status to success
      await supabase
        .from('messages')
        .update({
          status: 'success',
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', messageRecord.id);

      return { 
        message: 'Media processed successfully', 
        messageId: messageRecord.id, 
        ...result 
      };

    } catch (error) {
      console.error(`Attempt ${retryCount + 1} failed:`, error);
      retryCount++;

      const newStatus = retryCount >= MAX_RETRY_ATTEMPTS ? 'failed' : 'pending';
      console.log(`Updating message status to ${newStatus} after attempt ${retryCount}`);

      // Update message with retry information and set status to failed if max attempts reached
      const { error: updateError } = await supabase
        .from('messages')
        .update({
          retry_count: retryCount,
          last_retry_at: new Date().toISOString(),
          status: newStatus,
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
        console.error('Max retry attempts reached. Message marked as failed.');
        throw new Error(`Processing failed after ${MAX_RETRY_ATTEMPTS} attempts. Last error: ${error.message}`);
      }
    }
  }

  throw new Error(`Processing failed after ${MAX_RETRY_ATTEMPTS} attempts`);
}