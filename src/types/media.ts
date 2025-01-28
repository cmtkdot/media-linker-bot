import { Json } from "@/integrations/supabase/types";

export interface MessageMediaData {
  message: {
    url?: string;
    media_group_id?: string;
    caption?: string;
    message_id?: number;
    chat_id?: number;
    date?: number;
  };
  sender: {
    sender_info?: Record<string, any>;
    chat_info?: Record<string, any>;
  };
  analysis: {
    analyzed_content?: Record<string, any>;
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
    is_original_caption?: boolean;
    original_message_id?: string;
    correlation_id?: string;
    processed_at?: string;
    last_retry_at?: string;
    retry_count?: number;
  };
  media: {
    file_id?: string;
    file_unique_id?: string;
    file_type?: string;
    public_url?: string;
    storage_path?: string;
  };
  telegram_data: Record<string, any>;
}

export interface MediaItem {
  id: string;
  created_at: string;
  updated_at: string;

  file_id: string;
  file_unique_id: string;
  file_type: string;
  public_url?: string;
  storage_path?: string;

  product_name?: string;
  product_code?: string;
  quantity?: number;
  vendor_uid?: string;
  purchase_date?: string;
  notes?: string;

  processed?: boolean;
  processing_error?: string;

  analyzed_content: Record<string, any>;
  telegram_data: Record<string, any>;
  message_media_data: MessageMediaData;
  glide_data: Record<string, any>;
  media_metadata: Record<string, any>;

  telegram_media_row_id?: string;
  glide_app_url?: string;
  correlation_id?: string;
  message_id: string;
  caption?: string;
  message_url?: string;

  is_original_caption?: boolean;
  original_message_id?: string;
}

export interface MediaItemUpdate extends Partial<MediaItem> {
  id: string;
}