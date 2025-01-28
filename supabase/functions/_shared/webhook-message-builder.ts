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
    product_name?: string;
    product_code?: string;
    quantity?: number;
    vendor_uid?: string;
    purchase_date?: string;
    notes?: string;
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
  media?: {
    file_id: string;
    file_unique_id: string;
    file_type: string;
    public_url?: string;
    storage_path?: string;
    mime_type?: string;
  };
  telegram_data: Record<string, any>;
}

export function buildWebhookMessageData(
  message: TelegramMessage,
  messageUrl: string,
  analyzedContent: AnalyzedMessageContent
): WebhookMessageData {
  const now = new Date().toISOString();
  
  // Extract media info if present
  const mediaInfo = message.photo?.[0] || message.video || message.document || null;
  
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
      analyzed_content: analyzedContent.analyzed_content,
      product_name: analyzedContent.analyzed_content?.extracted_data?.product_name,
      product_code: analyzedContent.analyzed_content?.extracted_data?.product_code,
      quantity: analyzedContent.analyzed_content?.extracted_data?.quantity,
      vendor_uid: analyzedContent.analyzed_content?.extracted_data?.vendor_uid,
      purchase_date: analyzedContent.analyzed_content?.extracted_data?.purchase_date,
      notes: analyzedContent.analyzed_content?.extracted_data?.notes
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
    },
    media: mediaInfo ? {
      file_id: mediaInfo.file_id,
      file_unique_id: mediaInfo.file_unique_id,
      file_type: message.photo ? 'photo' : message.video ? 'video' : 'document',
      mime_type: message.video?.mime_type || message.document?.mime_type || 'image/jpeg'
    } : undefined,
    telegram_data: message
  };
}