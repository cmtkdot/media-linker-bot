import { Json } from "@/integrations/supabase/types";
import { TelegramMessage } from './telegram-types';

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
  };
  meta: {
    created_at: string;
    updated_at: string;
    status: 'pending' | 'processed' | 'error';
    error: string | null;
  };
  media?: {
    file_id: string;
    file_unique_id: string;
    file_type: string;
    public_url: string;
    storage_path?: string;
  };
  glide?: {
    row_id?: string;
    app_url?: string;
    sync_status?: string;
    last_sync?: string;
  };
}

export interface MediaItem {
  // Database fields
  id: string;
  created_at: string;
  updated_at: string;
  
  // File information
  file_id: string;
  file_unique_id: string;
  file_type: string;
  public_url: string;
  storage_path?: string;
  
  // Message reference
  message_id: number;
  message_url?: string;
  caption?: string;
  
  // Product information
  product_name?: string;
  product_code?: string;
  quantity?: number;
  vendor_uid?: string;
  purchase_date?: string;
  notes?: string;
  
  // Processing status
  processed?: boolean;
  processing_error?: string;
  
  // Rich data objects
  analyzed_content?: Record<string, any>;
  telegram_data: TelegramMessage;
  message_media_data: MessageMediaData;
  
  // Additional metadata
  glide_data?: Record<string, any>;
  media_metadata?: Record<string, any>;
  
  // Glide integration
  telegram_media_row_id?: string;
  glide_app_url?: string;
}

export interface MediaItemUpdate extends Partial<MediaItem> {
  id: string;
}

export interface MediaSearchBarProps {
  search: string;
  onSearchChange: (value: string) => void;
}