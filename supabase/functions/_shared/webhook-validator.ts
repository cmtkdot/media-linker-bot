import { TelegramWebhookUpdate } from './webhook-types.ts';

export function validateWebhookUpdate(update: TelegramWebhookUpdate): boolean {
  const message = update.message || update.channel_post;
  if (!message) {
    console.log('[No Message] Update contains no message');
    return false;
  }

  const hasMedia = message.photo || message.video || message.document || message.animation;
  if (!hasMedia) {
    console.log('[No Media] Not a media message, skipping');
    return false;
  }

  return true;
}