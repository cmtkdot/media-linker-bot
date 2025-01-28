import { TelegramMessage } from './telegram-types.ts';

export interface WebhookUpdate {
  update_id: number;
  message?: TelegramMessage;
  channel_post?: TelegramMessage;
}

export interface WebhookResponse {
  success: boolean;
  message: string;
  messageId?: string;
  data?: {
    telegram_data: TelegramMessage;
    message_media_data: Record<string, any>;
    status: string;
  };
}

export interface WebhookError {
  error: string;
  message_id?: number;
  chat_id?: number;
  status: string;
  retry_count: number;
}