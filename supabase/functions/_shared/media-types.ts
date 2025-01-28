import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface StorageResult {
  publicUrl: string;
  storagePath: string;
  isExisting: boolean;
}

export interface TelegramMediaFile {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  mime_type?: string;
}

export interface MessageMediaData {
  message: {
    url?: string;
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

export interface ProcessingResult {
  success: boolean;
  message: string;
  data?: {
    publicUrl?: string;
    storagePath?: string;
    messageId?: string;
    status: string;
  };
  error?: string;
}