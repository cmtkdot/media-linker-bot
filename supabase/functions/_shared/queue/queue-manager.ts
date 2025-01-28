import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { QueueItem } from '../../types/queue.types';

export async function queueWebhookMessage(
  supabase: any,
  messageData: any,
  correlationId: string,
  queueType: 'media' | 'webhook' | 'media_group'
): Promise<void> {
  try {
    console.log('Queueing message:', {
      message_id: messageData.message.message_id,
      queue_type: queueType,
      media_group_id: messageData.message.media_group_id,
      correlation_id: correlationId
    });

    const queueItem = {
      queue_type: messageData.message.media_group_id ? 'media_group' : queueType,
      message_media_data: messageData,
      status: 'pending',
      correlation_id: correlationId,
      chat_id: messageData.message.chat_id,
      message_id: messageData.message.message_id,
      priority: messageData.message.media_group_id ? 2 : 1
    };

    const { error } = await supabase
      .from('unified_processing_queue')
      .insert(queueItem);

    if (error) {
      // If it's a duplicate, we can safely ignore it
      if (error.code === '23505') {
        console.log('Message already queued:', {
          message_id: messageData.message.message_id,
          correlation_id: correlationId
        });
        return;
      }
      throw error;
    }

    console.log('Successfully queued message:', {
      message_id: messageData.message.message_id,
      correlation_id: correlationId,
      queue_type: queueType
    });
  } catch (error) {
    console.error('Error queueing message:', error);
    throw error;
  }
}

export async function processQueueItems(
  supabase: any,
  items: QueueItem[]
): Promise<void> {
  console.log(`Processing ${items.length} queue items`);

  for (const item of items) {
    try {
      console.log(`Processing queue item ${item.id}`);
      
      if (!item.message_media_data?.media?.file_id) {
        console.log(`Skipping item ${item.id} - missing media data`);
        continue;
      }

      // Process media using the unified processor
      const { processMediaItem } = await import('../media/media-processor.ts');
      await processMediaItem(supabase, item.message_media_data);

    } catch (error) {
      console.error(`Error processing queue item ${item.id}:`, error);
      
      // Update queue item with error
      await supabase
        .from('unified_processing_queue')
        .update({
          status: 'error',
          error_message: error.message,
          retry_count: (item.retry_count || 0) + 1
        })
        .eq('id', item.id);
    }
  }
}