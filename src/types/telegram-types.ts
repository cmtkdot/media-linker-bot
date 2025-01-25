export interface TelegramChat {
  id: number;
  type: string;
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

export interface TelegramVideo {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  duration: number;
  thumb?: TelegramPhotoSize;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramDocument {
  file_id: string;
  file_unique_id: string;
  thumb?: TelegramPhotoSize;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface MessageEntity {
  type: string;
  offset: number;
  length: number;
  url?: string;
  user?: TelegramUser;
  language?: string;
  custom_emoji_id?: string;
}

// AI Analysis Types
export interface ExtractedProductInfo {
  product_name: string | null;
  product_code: string | null;
  quantity: number | null;
  vendor_uid: string | null;
  purchase_date: string | null;
  notes: string | null;
}

export interface AnalyzedContent extends ExtractedProductInfo {
  raw_text: string;
  extracted_data: ExtractedProductInfo;
  confidence: number;
  timestamp: string;
  model_version: string;
}

// Message Processing Status
export type ProcessingStatus = 'pending' | 'processed' | 'error';

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  sender_chat?: TelegramChat;
  date: number;
  chat: TelegramChat;
  caption?: string;
  caption_entities?: MessageEntity[];
  media_group_id?: string;
  photo?: TelegramPhotoSize[];
  video?: TelegramVideo;
  document?: TelegramDocument;
  animation?: TelegramDocument;
}

// Webhook Flow Types
export interface WebhookMessageData {
  message_id: number;
  chat_id: number;
  sender_info: Record<string, any>;
  message_type: 'photo' | 'video' | 'document' | 'animation' | 'unknown';
  telegram_data: TelegramMessage;
  caption: string | null;
  media_group_id: string | null;
  message_url: string;
  analyzed_content: AnalyzedContent | null;
  status: ProcessingStatus;
  retry_count: number;
}

export interface MessageMediaData {
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
    analyzed_content: AnalyzedContent;
  };
  meta: {
    created_at: string;
    updated_at: string;
    status: ProcessingStatus;
    error: string | null;
  };
  media: {
    file_id: string;
    file_unique_id: string;
    file_type: string;
    public_url: string;
    storage_path: string;
  };
  glide?: {
    row_id?: string;
    app_url?: string;
    sync_status?: string;
    last_sync?: string;
  };
}

// Final Media Item Structure
export interface MediaItem {
  // Database fields
  id: string;
  created_at: string;
  updated_at: string;
  
  // File information
  file_id: string;
  file_unique_id: string;
  file_type: 'photo' | 'video' | 'document' | 'animation';
  public_url: string;
  storage_path: string;
  
  // Message reference
  message_id: string;
  message_url?: string;
  caption?: string;
  
  // Extracted product information (denormalized from analyzed_content)
  product_name?: string | null;
  product_code?: string | null;
  quantity?: number | null;
  vendor_uid?: string | null;
  purchase_date?: string | null;
  notes?: string | null;
  
  // Processing status
  processed?: boolean;
  processing_error?: string;
  
  // Rich data objects
  analyzed_content: AnalyzedContent;
  telegram_data: TelegramMessage;
  message_media_data: MessageMediaData;
  
  // Additional metadata
  glide_data?: Record<string, any>;
  media_metadata: {
    mime_type?: string;
    file_size?: number;
    width?: number;
    height?: number;
    duration?: number;
  };
  
  // Glide integration
  telegram_media_row_id?: string;
  glide_app_url?: string;
} 