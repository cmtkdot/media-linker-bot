import { TelegramMessage } from './telegram-types';
import { MessageMediaData } from './media-types';

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
    analyzed_content?: Record<string, any>;
    telegram_data: TelegramMessage;
    message_media_data: MessageMediaData;
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

export interface ProcessedMessage {
  id: string;
  message_id: number;
  chat_id: number;
  message_type: string;
  retry_count: number;
  last_retry_at?: string;
  telegram_data: TelegramMessage;
  message_media_data: MessageMediaData;
  analyzed_content?: Record<string, any>;
  status: string;
  created_at: string;
  updated_at: string;
}