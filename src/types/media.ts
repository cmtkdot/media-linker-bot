import { Json } from "@/integrations/supabase/types";

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
    caption?: string;
  };
  meta: {
    created_at: string;
    updated_at: string;
    status: "pending" | "processed" | "error" | "processing";
    error: string | null;
    is_original_caption?: boolean;
    original_message_id?: string;
    retry_count?: number;
  };
  media: {
    file_id: string;
    file_unique_id: string;
    file_type: string;
    public_url: string;
  };
}

export interface MediaItem {
  id: string;
  created_at: string;
  updated_at: string;

  file_id: string;
  file_unique_id: string;
  file_type: string;
  public_url: string;

  message_id: string;
  message_url?: string;
  caption?: string;
  media_group_id?: string;

  product_name?: string;
  product_code?: string;
  quantity?: number;
  vendor_uid?: string;
  purchase_date?: string;
  notes?: string;
  caption?: string;

  processed?: boolean;
  processing_error?: string;

  analyzed_content: Record<string, any>;
  telegram_data: Record<string, any>;
  message_media_data: MessageMediaData;
  glide_data: Record<string, any>;
  media_metadata: Record<string, any>;

  telegram_media_row_id?: string;
  glide_app_url?: string;
  glide_json?: Json;
  last_synced_at?: string;
  message_data?: Json;
  purchase_order_uid?: string;

  is_original_caption?: boolean;
  original_message_id?: string;
}

export interface MediaItemUpdate extends Partial<MediaItem> {
  id: string;
}

export interface SyncResult {
  synced_count: number;
  error_count: number;
}

export interface TableResult {
  table_name: string;
}
