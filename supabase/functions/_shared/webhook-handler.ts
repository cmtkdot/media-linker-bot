import { processMessageBatch } from './message-processor.ts';
import { processMediaFiles } from './media-processor.ts';
import { delay } from './retry-utils.ts';

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
      media_group_id: message.media_group_id
    });

    // Step 1: Process message first
    await processMessageBatch([message], supabase);
    await delay(1000);

    // Step 2: Get the created message record
    const { data: messageRecord } = await supabase
      .from('messages')
      .select('*')
      .eq('message_id', message.message_id)
      .eq('chat_id', message.chat.id)
      .single();

    if (!messageRecord) {
      throw new Error('Failed to create message record');
    }

    // Step 3: Process media files if present
    const hasMedia = message.photo || message.video || message.document || message.animation;
    if (hasMedia) {
      await processMediaFiles(message, messageRecord, supabase, botToken);
    }

    // Step 4: Update message status
    await supabase
      .from('messages')
      .update({
        status: 'success',
        processed_at: new Date().toISOString()
      })
      .eq('id', messageRecord.id);

    return {
      success: true,
      message: 'Update processed successfully',
      messageId: messageRecord.id
    };

  } catch (error) {
    console.error('Error in webhook handler:', error);
    throw error;
  }
}