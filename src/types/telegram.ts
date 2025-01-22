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