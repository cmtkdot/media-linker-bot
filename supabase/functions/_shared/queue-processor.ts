import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { MediaProcessingError } from "./error-handler.ts";

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

interface QueueItem {
  id: string;
  message_media_data: Record<string, any>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retry_count: number;
}

export async function processMessageQueue(
  supabase: SupabaseClient,
  correlationId: string
) {
  console.log('Processing message queue:', { correlationId });

  try {
    // Get pending messages
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10);

    if (error) throw error;
    if (!messages?.length) {
      console.log('No pending messages found');
      return;
    }

    console.log(`Found ${messages.length} pending messages`);

    for (const message of messages) {
      try {
        await processQueueItem(supabase, message, correlationId);
      } catch (error) {
        console.error('Error processing message:', error);
        await updateMessageStatus(supabase, message.id, 'failed', error);
      }
    }
  } catch (error) {
    console.error('Error in queue processor:', error);
    throw error;
  }
}

async function processQueueItem(
  supabase: SupabaseClient,
  message: any,
  correlationId: string
) {
  console.log('Processing queue item:', {
    messageId: message.id,
    correlationId
  });

  // Update status to processing
  await updateMessageStatus(supabase, message.id, 'processing');

  try {
    // Ensure message_media_data structure
    const messageMediaData = validateAndStructureMediaData(message);

    // Create or update telegram_media record
    await updateTelegramMedia(supabase, message.id, messageMediaData);

    // Mark message as completed
    await updateMessageStatus(supabase, message.id, 'completed');

    console.log('Successfully processed message:', message.id);
  } catch (error) {
    console.error('Error processing message:', error);
    const shouldRetry = message.retry_count < MAX_RETRIES;
    
    await updateMessageStatus(
      supabase,
      message.id,
      shouldRetry ? 'pending' : 'failed',
      error,
      message.retry_count + 1
    );

    if (!shouldRetry) {
      throw new MediaProcessingError(
        'Max retries exceeded',
        'MAX_RETRIES_EXCEEDED',
        { messageId: message.id },
        false
      );
    }

    // Wait before next retry
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, message.retry_count)));
  }
}

function validateAndStructureMediaData(message: any) {
  const mediaData = message.message_media_data || {};
  
  // Ensure required sections exist
  const structured = {
    message: mediaData.message || {},
    sender: mediaData.sender || {},
    analysis: mediaData.analysis || {},
    meta: {
      created_at: message.created_at,
      updated_at: new Date().toISOString(),
      status: message.status,
      error: message.processing_error,
      is_original_caption: message.is_original_caption,
      original_message_id: message.original_message_id,
      correlation_id: message.correlation_id,
      processed_at: message.processed_at,
      last_retry_at: message.last_retry_at,
      retry_count: message.retry_count
    },
    telegram_data: message.telegram_data || {}
  };

  return structured;
}

async function updateTelegramMedia(
  supabase: SupabaseClient,
  messageId: string,
  messageMediaData: Record<string, any>
) {
  const { error } = await supabase
    .from('telegram_media')
    .upsert({
      message_id: messageId,
      file_id: messageMediaData.media?.file_id,
      file_unique_id: messageMediaData.media?.file_unique_id,
      file_type: messageMediaData.media?.file_type,
      public_url: messageMediaData.media?.public_url,
      storage_path: messageMediaData.media?.storage_path,
      message_media_data: messageMediaData,
      telegram_data: messageMediaData.telegram_data,
      is_original_caption: messageMediaData.meta.is_original_caption,
      original_message_id: messageMediaData.meta.original_message_id,
      correlation_id: messageMediaData.meta.correlation_id,
      analyzed_content: messageMediaData.analysis.analyzed_content
    })
    .select()
    .single();

  if (error) throw error;
}

async function updateMessageStatus(
  supabase: SupabaseClient,
  messageId: string,
  status: string,
  error?: any,
  retryCount?: number
) {
  const updates: Record<string, any> = {
    status,
    updated_at: new Date().toISOString()
  };

  if (error) {
    updates.processing_error = error instanceof Error ? error.message : String(error);
  }

  if (retryCount !== undefined) {
    updates.retry_count = retryCount;
    updates.last_retry_at = new Date().toISOString();
  }

  if (status === 'completed') {
    updates.processed_at = new Date().toISOString();
  }

  const { error: updateError } = await supabase
    .from('messages')
    .update(updates)
    .eq('id', messageId);

  if (updateError) throw updateError;
}