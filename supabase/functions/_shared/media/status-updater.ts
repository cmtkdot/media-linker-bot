import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function updateMediaStatus(
  supabase: ReturnType<typeof createClient>,
  messageId: string,
  status: string,
  error?: string
) {
  console.log('Updating media status:', { messageId, status, error });

  try {
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('message_media_data, correlation_id')
      .eq('id', messageId)
      .maybeSingle();

    if (messageError) throw messageError;
    if (!message) throw new Error('Message not found');

    const updatedMessageMediaData = {
      ...message.message_media_data,
      meta: {
        ...message.message_media_data.meta,
        status,
        error: error || null,
        processed_at: status === 'processed' ? new Date().toISOString() : null
      }
    };

    // Update message status
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        message_media_data: updatedMessageMediaData,
        status,
        processed_at: status === 'processed' ? new Date().toISOString() : null,
        processing_error: error || null
      })
      .eq('id', messageId);

    if (updateError) throw updateError;

    // Update telegram_media status if exists
    if (message.correlation_id) {
      const { error: mediaUpdateError } = await supabase
        .from('telegram_media')
        .update({
          message_media_data: updatedMessageMediaData,
          status,
          processed: status === 'processed',
          processing_error: error || null,
          processed_at: status === 'processed' ? new Date().toISOString() : null
        })
        .eq('correlation_id', message.correlation_id);

      if (mediaUpdateError) throw mediaUpdateError;
    }

    console.log('Status update completed:', { messageId, status });
    return true;
  } catch (error) {
    console.error('Error updating media status:', error);
    throw error;
  }
}