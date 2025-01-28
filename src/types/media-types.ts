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
  };
  meta: {
    created_at: string;
    updated_at: string;
    status: string;
    error: string | null;
    is_original_caption: boolean;
    original_message_id: string | null;
    correlation_id?: string;
    processed_at?: string;
    last_retry_at?: string;
    retry_count?: number;
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

export interface MediaFile {
  file_id: string;
  file_unique_id: string;
  file_type: string;
  mime_type?: string;
  public_url?: string;
  storage_path?: string;
}

export interface MediaProcessingResult {
  success: boolean;
  publicUrl?: string;
  storagePath?: string;
  error?: string;
}