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
    correlation_id?: string;
    processed_at?: string | null;
    last_retry_at?: string | null;
    retry_count?: number;
  };
  media?: {
    file_id?: string;
    file_unique_id?: string;
    file_type?: string;
    public_url?: string;
    storage_path?: string;
    mime_type?: string;
    width?: number;
    height?: number;
    duration?: number;
    file_size?: number;
  };
  telegram_data: Record<string, any>;
}

export function buildWebhookMessageData(
  message: TelegramMessage,
  messageUrl: string,
  analyzedContent: AnalyzedMessageContent
): WebhookMessageData {
  const now = new Date().toISOString();
  
  const extractedData = analyzedContent.analyzed_content?.analyzed_content?.extracted_data || 
                       analyzedContent.analyzed_content?.extracted_data || {};
  
  // Extract media information
  const mediaInfo = extractMediaInfo(message);
  
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
      product_name: extractedData.product_name,
      product_code: extractedData.product_code,
      quantity: extractedData.quantity,
      vendor_uid: extractedData.vendor_uid,
      purchase_date: extractedData.purchase_date,
      notes: extractedData.notes
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
    media: mediaInfo,
    telegram_data: message
  };
}

function extractMediaInfo(message: TelegramMessage) {
  if (message.photo) {
    const largestPhoto = message.photo[message.photo.length - 1];
    return {
      file_id: largestPhoto.file_id,
      file_unique_id: largestPhoto.file_unique_id,
      file_type: 'photo',
      width: largestPhoto.width,
      height: largestPhoto.height,
      file_size: largestPhoto.file_size
    };
  }
  
  if (message.video) {
    return {
      file_id: message.video.file_id,
      file_unique_id: message.video.file_unique_id,
      file_type: 'video',
      mime_type: message.video.mime_type,
      width: message.video.width,
      height: message.video.height,
      duration: message.video.duration,
      file_size: message.video.file_size
    };
  }
  
  if (message.document) {
    return {
      file_id: message.document.file_id,
      file_unique_id: message.document.file_unique_id,
      file_type: 'document',
      mime_type: message.document.mime_type,
      file_size: message.document.file_size
    };
  }
  
  if (message.animation) {
    return {
      file_id: message.animation.file_id,
      file_unique_id: message.animation.file_unique_id,
      file_type: 'animation',
      mime_type: message.animation.mime_type,
      file_size: message.animation.file_size
    };
  }
  
  return undefined;
}