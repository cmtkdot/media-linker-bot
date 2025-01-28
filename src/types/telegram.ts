export interface TelegramMessage {
  id: string;
  message_id: number;
  chat_id: number;
  sender_info: Record<string, any>;
  message_type: string;
  telegram_data: Record<string, any>;
  media_group_id?: string;
  processed_at?: string;
  processing_error?: string;
  created_at: string;
  updated_at: string;
  retry_count?: number;
  last_retry_at?: string;
  status?: string;
  analyzed_content?: Record<string, any>;
  message_url?: string;
  correlation_id?: string;
  message_media_data?: Record<string, any>;
  is_original_caption?: boolean;
  original_message_id?: string;
  raw_text?: string;
  // New extracted content fields
  product_name?: string;
  product_code?: string;
  quantity?: number;
  vendor_uid?: string;
  purchase_date?: string;
  notes?: string;
  purchase_order_uid?: string;
}