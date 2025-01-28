import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleMediaError } from './error-handler.ts';
import { processMediaMessage } from './processor.ts';

export async function processMessageQueue(
  supabase: ReturnType<typeof createClient>,
  correlationId: string,
  botToken: string
) {
  console.log('Processing message queue:', { correlationId });

  try {
    // Get pending messages with message_media_data
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*, message_media_data')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10);

    if (error) throw error;

    console.log(`Found ${messages?.length || 0} pending messages to process`);

    const results = {
      processed: 0,
      skipped: 0,
      errors: 0,
      details: [] as string[]
    };

    // Process each message
    for (const message of messages || []) {
      try {
        // Skip messages without media data
        if (!message.message_media_data?.media?.file_id) {
          console.log('Skipping message without media:', message.id);
          results.skipped++;
          results.details.push(`Skipped message ${message.id}: No media data`);
          continue;
        }

        // Check for existing telegram_media record
        const { data: existingMedia } = await supabase
          .from('telegram_media')
          .select('*')
          .eq('file_unique_id', message.message_media_data.media.file_unique_id)
          .maybeSingle();

        if (existingMedia) {
          // Check for changes in caption or analyzed content
          const hasChanges = checkForChanges(existingMedia, message);
          if (!hasChanges) {
            console.log('No changes detected for media:', existingMedia.id);
            results.skipped++;
            results.details.push(`Skipped message ${message.id}: No changes detected`);
            continue;
          }
        }

        await processMediaMessage(supabase, message, botToken);
        results.processed++;
        results.details.push(`Processed message ${message.id} successfully`);

      } catch (error) {
        console.error('Error processing message:', error);
        results.errors++;
        results.details.push(`Error processing message ${message.id}: ${error.message}`);
        
        await handleMediaError(
          supabase,
          error,
          message.id,
          correlationId,
          'processMessageQueue',
          message.retry_count || 0
        );
      }
    }

    return {
      ...results,
      correlationId
    };
  } catch (error) {
    console.error('Queue processing error:', error);
    throw error;
  }
}

function checkForChanges(existingMedia: any, newMessage: any): boolean {
  // Check caption changes
  const existingCaption = existingMedia.message_media_data?.message?.caption;
  const newCaption = newMessage.message_media_data?.message?.caption;
  if (existingCaption !== newCaption) return true;

  // Check analyzed content changes
  const existingAnalysis = JSON.stringify(existingMedia.message_media_data?.analysis || {});
  const newAnalysis = JSON.stringify(newMessage.message_media_data?.analysis || {});
  if (existingAnalysis !== newAnalysis) return true;

  // Check media group changes
  const existingGroupId = existingMedia.message_media_data?.message?.media_group_id;
  const newGroupId = newMessage.message_media_data?.message?.media_group_id;
  if (existingGroupId !== newGroupId) return true;

  return false;
}