import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { QueueItem } from '../../types/queue.types';

export async function queueMessage(
  supabase: any,
  message: any,
  correlationId: string
): Promise<void> {
  try {
    const queueItem: QueueItem = {
      queue_type: message.media_group_id ? 'media_group' : 'media',
      message_media_data: message.message_media_data,
      status: 'pending',
      correlation_id: correlationId,
      chat_id: message.chat_id,
      message_id: message.message_id
    };

    const { error } = await supabase
      .from('unified_processing_queue')
      .insert(queueItem);

    if (error) throw error;

    console.log('Message queued successfully:', {
      message_id: message.message_id,
      correlation_id: correlationId
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
  for (const item of items) {
    try {
      await processQueueItem(supabase, item);
    } catch (error) {
      console.error(`Error processing queue item ${item.id}:`, error);
    }
  }
}

async function processQueueItem(
  supabase: any,
  item: QueueItem
): Promise<void> {
  // Implementation moved to media-processor.ts
  const { processMediaItem } = await import('../media/media-processor');
  await processMediaItem(supabase, item);
}