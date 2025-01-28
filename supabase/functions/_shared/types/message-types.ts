export interface MessageData {
  message_id: number;
  chat_id: number;
  caption?: string;
  media_group_id?: string;
  url?: string;
  date: number;
}

export interface MediaData {
  file_id: string;
  file_unique_id: string;
  file_type: string;
  public_url?: string;
  storage_path?: string;
  mime_type?: string;
}

export interface MessageMetadata {
  created_at: string;
  updated_at: string;
  status: string;
  error: string | null;
  is_original_caption: boolean;
  original_message_id: string | null;
  processed_at: string | null;
  last_retry_at: string | null;
  retry_count: number;
  correlation_id?: string;
}

export interface MessageMediaData {
  message?: MessageData;
  media?: MediaData;
  meta?: MessageMetadata;
  analysis?: {
    analyzed_content?: Record<string, any>;
    product_name?: string;
    product_code?: string;
    quantity?: number;
    vendor_uid?: string;
    purchase_date?: string;
    notes?: string;
  };
  sender?: {
    sender_info: Record<string, any>;
    chat_info: Record<string, any>;
  };
}