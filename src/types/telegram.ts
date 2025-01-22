export interface TelegramMedia {
  id: string;
  file_id: string;
  file_unique_id: string;
  file_type: string;
  public_url?: string;
  product_name?: string;
  product_code?: string;
  quantity?: number;
  telegram_data: Record<string, any>;
  glide_data: Record<string, any>;
  media_metadata: Record<string, any>;
  processed?: boolean;
  processing_error?: string;
  last_synced_at?: string;
  created_at: string;
  updated_at: string;
  message_id?: string;
  caption?: string;
  vendor_uid?: string;
  purchase_date?: string;
  notes?: string;
  analyzed_content?: Record<string, any>;
  purchase_order_uid?: string;
  default_public_url?: string;
  telegram_media_row_id?: string;
}

export interface TelegramMessage {
  id: string;
  message_id: number;
  chat_id: number;
  sender_info: Record<string, any>;
  message_type: string;
  message_data: Record<string, any>;
  caption?: string;
  media_group_id?: string;
  product_name?: string;
  product_code?: string;
  quantity?: number;
  processed_at?: string;
  processing_error?: string;
  created_at: string;
  updated_at: string;
  retry_count?: number;
  last_retry_at?: string;
  status?: string;
  vendor_uid?: string;
  purchase_date?: string;
  notes?: string;
  analyzed_content?: Record<string, any>;
  purchase_order_uid?: string;
}