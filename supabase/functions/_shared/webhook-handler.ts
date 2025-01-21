import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { TelegramUpdate } from './telegram-types.ts';
import { analyzeCaption } from './telegram-service.ts';
import { createMessage } from './database-service.ts';
import { processMediaFile } from './media-processor.ts';

const MAX_RETRY_ATTEMPTS = 3;

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

  // Check for existing message
  const { data: existingMessage } = await supabase
    .from('messages')
    .select('id')
    .eq('chat_id', message.chat.id)
    .eq('message_id', message.message_id)
    .maybeSingle();

  if (existingMessage) {
    console.log('Message already processed:', existingMessage);
    return { message: 'Message already processed' };
  }

  let productInfo = null;
  if (message.caption) {
    console.log('Analyzing caption:', message.caption);
    productInfo = await analyzeCaption(
      message.caption,
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );
  }

  const messageRecord = await createMessage(supabase, message, productInfo);

  const mediaTypes = ['photo', 'video', 'document', 'animation'] as const;
  let mediaFile = null;
  let mediaType = '';

  for (const type of mediaTypes) {
    if (message[type]) {
      mediaFile = type === 'photo' 
        ? message[type]![message[type]!.length - 1]
        : message[type];
      mediaType = type;
      break;
    }
  }

  if (!mediaFile) {
    throw new Error('No media file found in message');
  }

  const result = await processMediaFile(
    supabase,
    mediaFile,
    mediaType,
    message,
    messageRecord,
    botToken,
    productInfo
  );

  return { message: 'Media processed successfully', messageId: messageRecord.id, ...result };
}