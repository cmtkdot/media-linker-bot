import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { TelegramUpdate } from './telegram-types.ts';
import { analyzeCaptionWithAI } from './caption-analyzer.ts';
import { handleMessageProcessing } from './message-manager.ts';
import { processMedia } from './media-handler.ts';

export async function handleWebhookUpdate(
  update: TelegramUpdate,
  supabase: any,
  botToken: string
) {
  const message = update.message || update.channel_post;
  if (!message) {
    console.log('No message in update');
    return { message: 'No message in update' };
  }

  const hasMedia = message.photo || message.video || message.document || message.animation;
  if (!hasMedia) {
    console.log('Not a media message, skipping');
    return { message: 'Not a media message, skipping' };
  }

  console.log('Processing media message:', {
    message_id: message.message_id,
    chat_id: message.chat.id,
    media_type: message.photo ? 'photo' : 
                message.video ? 'video' : 
                message.document ? 'document' : 
                message.animation ? 'animation' : 'unknown'
  });

  try {
    let productInfo = null;
    if (message.caption) {
      productInfo = await analyzeCaptionWithAI(
        message.caption,
        Deno.env.get('SUPABASE_URL') || '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
      );
    }

    const { data: existingMessage, error: fetchError } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', message.chat.id)
      .eq('message_id', message.message_id)
      .maybeSingle();

    if (fetchError) {
      console.error('Error checking for existing message:', {
        error: fetchError,
        message_id: message.message_id,
        chat_id: message.chat.id
      });
      
      await supabase.from('failed_webhook_updates').insert({
        message_id: message.message_id,
        chat_id: message.chat.id,
        error_message: fetchError.message,
        error_stack: fetchError.stack,
        message_data: message,
        status: 'failed'
      });
      
      return { 
        error: 'Failed to check for existing message',
        details: fetchError.message
      };
    }

    const { messageRecord, retryCount } = await handleMessageProcessing(
      supabase,
      message,
      existingMessage,
      productInfo
    );

    return await processMedia(
      supabase,
      message,
      messageRecord,
      botToken,
      productInfo,
      retryCount
    );

  } catch (error) {
    console.error('Error in handleWebhookUpdate:', {
      error: error.message,
      stack: error.stack,
      message_id: message?.message_id,
      chat_id: message?.chat?.id
    });
    
    await supabase.from('failed_webhook_updates').insert({
      message_id: message?.message_id,
      chat_id: message?.chat?.id,
      error_message: error.message,
      error_stack: error.stack,
      message_data: message,
      status: 'failed'
    });
    
    throw error;
  }
}