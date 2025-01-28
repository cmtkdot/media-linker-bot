export interface TelegramMessage {
  message_id: number;
  chat: {
    id: number;
    type: string;
    [key: string]: any;
  };
  from?: Record<string, any>;
  sender_chat?: Record<string, any>;
  date: number;
  text?: string;
  caption?: string;
  photo?: Array<{
    file_id: string;
    file_unique_id: string;
    width: number;
    height: number;
    file_size?: number;
  }>;
  video?: {
    file_id: string;
    file_unique_id: string;
    width: number;
    height: number;
    duration: number;
    file_size?: number;
  };
  media_group_id?: string;
  [key: string]: any;
}

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