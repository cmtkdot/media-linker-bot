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
  };
  media?: {
    file_id: string;
    file_unique_id: string;
    file_type: string;
    public_url?: string;
    storage_path?: string;
    mime_type?: string;
  };
  telegram_data?: Record<string, any>;
}