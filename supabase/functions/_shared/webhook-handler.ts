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
      media_group_id: message.media_group_id,
      message_type: message.photo ? 'photo' : 
                   message.video ? 'video' : 
                   message.document ? 'document' : 
                   message.animation ? 'animation' : 'unknown'
    });

    // Step 1: Process message first with error handling
    try {
      await processMessageBatch([message], supabase);
    } catch (error) {
      console.error('Error processing message batch:', {
        error: error.message,
        stack: error.stack,
        message_id: message.message_id,
        chat_id: message.chat.id
      });
      throw new Error(`Failed to process message batch: ${error.message}`);
    }

    await delay(1000);

    // Step 2: Get the created message record with validation
    const { data: messageRecord, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('message_id', message.message_id)
      .eq('chat_id', message.chat.id)
      .maybeSingle();

    if (messageError) {
      console.error('Error fetching message record:', {
        error: messageError,
        message_id: message.message_id,
        chat_id: message.chat.id
      });
      throw new Error(`Failed to fetch message record: ${messageError.message}`);
    }

    if (!messageRecord) {
      console.error('Message record not found after creation:', {
        message_id: message.message_id,
        chat_id: message.chat.id
      });
      throw new Error('Failed to create message record: Record not found after creation');
    }

    // Step 3: Process media files if present with detailed error handling
    const hasMedia = message.photo || message.video || message.document || message.animation;
    if (hasMedia) {
      try {
        await processMediaFiles(message, messageRecord, supabase, botToken);
      } catch (error) {
        console.error('Error processing media files:', {
          error: error.message,
          stack: error.stack,
          message_id: messageRecord.id,
          media_type: message.photo ? 'photo' : 
                     message.video ? 'video' : 
                     message.document ? 'document' : 
                     message.animation ? 'animation' : 'unknown'
        });
        throw new Error(`Failed to process media files: ${error.message}`);
      }
    }

    // Step 4: Update message status with error handling
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        status: 'success',
        processed_at: new Date().toISOString()
      })
      .eq('id', messageRecord.id);

    if (updateError) {
      console.error('Error updating message status:', {
        error: updateError,
        message_id: messageRecord.id
      });
      throw new Error(`Failed to update message status: ${updateError.message}`);
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