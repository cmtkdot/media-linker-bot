import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleMediaError } from './error-handler.ts';
import { processMediaMessage } from './processor.ts';

interface QueueProcessorOptions {
  messageId: string;
  correlationId: string;
  messageMediaData: Record<string, any>;
  telegramData: Record<string, any>;
  isOriginalCaption: boolean;
  originalMessageId?: string;
}

export async function processMessageQueue(
  supabase: ReturnType<typeof createClient>,
  correlationId: string,
  botToken: string
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

    console.log(`Found ${messages?.length || 0} pending messages to process`);

    // Process each message
    for (const message of messages || []) {
      try {
        await processMediaMessage(supabase, message, botToken);
      } catch (error) {
        console.error('Error processing message:', error);
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
      processed: messages?.length || 0,
      correlationId
    };
  } catch (error) {
    console.error('Queue processing error:', error);
    throw error;
  }
}