import { TelegramMessage } from './telegram-types';

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

export interface FailedWebhookUpdate {
  id: string;
  message_id: string;
  chat_id: number;
  error_message: string;
  error_stack?: string;
  retry_count: number;
  last_retry_at?: string;
  telegram_data: TelegramMessage;
  analyzed_content?: Record<string, any>;
  status: string;
  created_at: string;
  updated_at: string;
}