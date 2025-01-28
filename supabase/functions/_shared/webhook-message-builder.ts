import { TelegramMessage } from './telegram-types.ts';
import { AnalyzedMessageContent } from './webhook-message-analyzer.ts';

export interface WebhookMessageData {
  message: {
    url: string;
    media_group_id?: string;
    caption?: string;
    message_id: number;
    chat_id: number;
    date: number;
  };
  sender: {
    sender_info: Record<string, any>;
    chat_info: Record<string, any>;
  };
  analysis: {
    analyzed_content: Record<string, any>;
  };
  meta: {
    created_at: string;
    updated_at: string;
    status: string;
    error: string | null;
    is_original_caption: boolean;
    original_message_id: string | null;
    processed_at: string | null;
    last_retry_at: string | null;
    retry_count: number;
  };
}

export function buildWebhookMessageData(
  message: TelegramMessage,
  messageUrl: string,
  analyzedContent: AnalyzedMessageContent
): WebhookMessageData {
  const now = new Date().toISOString();
  
  // Extract analyzed data if available
  const extractedData = analyzedContent.analyzed_content?.analyzed_content?.extracted_data || {};
  
  return {
    message: {
      url: messageUrl,
      media_group_id: message.media_group_id,
      caption: message.caption,
      message_id: message.message_id,
      chat_id: message.chat.id,
      date: message.date
    },
    sender: {
      sender_info: message.from || message.sender_chat || {},
      chat_info: message.chat
    },
    analysis: {
      analyzed_content: analyzedContent.analyzed_content
    },
    meta: {
      created_at: now,
      updated_at: now,
      status: 'pending',
      error: null,
      is_original_caption: analyzedContent.is_original_caption,
      original_message_id: analyzedContent.original_message_id,
      processed_at: null,
      last_retry_at: null,
      retry_count: 0
    }
  };
}