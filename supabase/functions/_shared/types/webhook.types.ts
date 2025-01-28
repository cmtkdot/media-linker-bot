import { TelegramMessage } from './telegram.types';

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
    status: 'pending' | 'processed' | 'failed';
  };
}

export interface WebhookError {
  error: string;
  message_id?: number;
  chat_id?: number;
  status: 'pending' | 'processed' | 'failed';
  retry_count: number;
}