import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { delay } from './retry-utils.ts';
import { withDatabaseRetry } from './database-retry.ts';
import { handleProcessingError } from './error-handler.ts';
import { processMediaFiles } from './media-processor.ts';
import { analyzeCaptionWithAI } from './caption-analyzer.ts';

export async function processMessageBatch(messages: any[], supabase: any, botToken: string) {
  console.log('Starting message batch processing:', { count: messages.length });
  
  for (const message of messages) {
    try {
      console.log('Processing message:', {
        message_id: message.message_id,
        chat_id: message.chat.id,
        has_media: !!(message.photo || message.video || message.document || message.animation),
        media_group_id: message.media_group_id
      });

      // Generate message URL
      const chatId = message.chat.id.toString();
      const messageUrl = `https://t.me/c/${chatId.substring(4)}/${message.message_id}`;

      // Analyze caption if present
      let analyzedContent = null;
      if (message.caption) {
        try {
          console.log('Analyzing caption:', message.caption);
          analyzedContent = await analyzeCaptionWithAI(message.caption);
          console.log('Caption analysis result:', analyzedContent);
        } catch (error) {
          console.error('Error analyzing caption:', error);
        }
      }

      const messageData = {
        message_id: message.message_id,
        chat_id: message.chat.id,
        sender_info: message.from || message.sender_chat || {},
        message_type: getMessageType(message),
        message_data: message,
        caption: message.caption,
        media_group_id: message.media_group_id,
        message_url: messageUrl,
        analyzed_content: analyzedContent,
        product_name: analyzedContent?.product_name || null,
        product_code: analyzedContent?.product_code || null,
        quantity: analyzedContent?.quantity || null,
        vendor_uid: analyzedContent?.vendor_uid || null,
        purchase_date: analyzedContent?.purchase_date || null,
        notes: analyzedContent?.notes || null,
        status: 'pending'
      };

      // Create or update message record with retry
      const messageRecord = await withDatabaseRetry(async () => {
        console.log('Creating/updating message record');
        
        const { data: existingMessage } = await supabase
          .from('messages')
          .select('*')
          .eq('message_id', message.message_id)
          .eq('chat_id', message.chat.id)
          .maybeSingle();

        if (existingMessage) {
          const { data, error: updateError } = await supabase
            .from('messages')
            .update(messageData)
            .eq('id', existingMessage.id)
            .select()
            .single();

          if (updateError) throw updateError;
          return data;
        } else {
          const { data, error: insertError } = await supabase
            .from('messages')
            .insert([messageData])
            .select()
            .single();

          if (insertError) throw insertError;
          return data;
        }
      }, 0, `create_message_${message.message_id}`);

      // Process media if present
      const hasMedia = message.photo || message.video || message.document || message.animation;
      if (hasMedia && messageRecord) {
        console.log('Initiating media processing for message:', {
          message_id: messageRecord.id,
          media_type: getMessageType(message)
        });

        try {
          await processMediaFiles(message, messageRecord, supabase, botToken);
          console.log('Media processing completed successfully');
        } catch (error) {
          console.error('Error processing media:', error);
          await handleProcessingError(
            supabase,
            error,
            messageRecord,
            0,
            false
          );
        }
      }

      // Add delay between messages
      await delay(500);
    } catch (error) {
      console.error('Error processing message:', error);
      throw error;
    }
  }
}

function getMessageType(message: any): string {
  if (message.photo) return 'photo';
  if (message.video) return 'video';
  if (message.document) return 'document';
  if (message.animation) return 'animation';
  return 'unknown';
}