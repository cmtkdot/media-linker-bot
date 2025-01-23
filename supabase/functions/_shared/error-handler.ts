import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function handleProcessingError(
  supabase: any,
  error: any,
  messageRecord: any,
  retryCount: number,
  isFinalAttempt: boolean
): Promise<{ shouldContinue: boolean }> {
  console.error('Processing error:', {
    error: error.message,
    stack: error.stack,
    message_id: messageRecord?.id,
    retry_count: retryCount
  });

  try {
    // Check if this is a duplicate message error
    if (error.code === '23505' && error.message.includes('messages_message_id_chat_id_key')) {
      console.log('Duplicate message detected, checking for telegram_media records');

      // Get the existing message record
      const { data: existingMessage } = await supabase
        .from('messages')
        .select('id')
        .eq('message_id', messageRecord.message_id)
        .eq('chat_id', messageRecord.chat_id)
        .maybeSingle();

      if (existingMessage) {
        // Check if there's a telegram_media record for this message
        const { data: mediaRecord } = await supabase
          .from('telegram_media')
          .select('id')
          .eq('message_id', existingMessage.id)
          .maybeSingle();

        if (!mediaRecord) {
          console.log('No telegram_media record found for duplicate message, continuing processing');
          return { shouldContinue: true };
        }

        console.log('Telegram media record exists for duplicate message, skipping');
        return { shouldContinue: false };
      }
    }

    // Update the message record with error information
    if (messageRecord) {
      const { error: updateError } = await supabase
        .from('messages')
        .update({
          processing_error: error.message,
          retry_count: retryCount,
          last_retry_at: new Date().toISOString(),
          status: isFinalAttempt ? 'failed' : 'pending'
        })
        .eq('id', messageRecord.id);

      if (updateError) {
        console.error('Error updating message record:', updateError);
      }

      // Log failed webhook update if this is the final attempt
      if (isFinalAttempt) {
        const { error: insertError } = await supabase
          .from('failed_webhook_updates')
          .insert([{
            message_id: messageRecord.message_id,
            chat_id: messageRecord.chat_id,
            error_message: error.message,
            error_stack: error.stack,
            retry_count: retryCount,
            message_data: messageRecord,
            status: 'failed'
          }]);

        if (insertError) {
          console.error('Error logging failed webhook update:', insertError);
        }
      }
    }

    // For non-duplicate errors or if we should retry, return shouldContinue based on final attempt
    return { shouldContinue: !isFinalAttempt };
  } catch (handlingError) {
    console.error('Error in error handler:', handlingError);
    return { shouldContinue: !isFinalAttempt };
  }
}