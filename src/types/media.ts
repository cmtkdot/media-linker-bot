import { Json } from "@/integrations/supabase/types";

export type ThumbnailSource = 'telegram' | 'app_generated' | 'media_group' | 'default';

export interface TelegramMessageData {
  message_data?: {
    caption?: string;
    chat?: {
      id: number;
      title: string;
      type: string;
    };
    media_group_id?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

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
    error?: string;
  };
}

export interface MediaItem {
  id: string;
  file_id: string;
  file_unique_id: string;
  file_type: 'photo' | 'video' | 'document' | 'animation';
  public_url?: string;
  default_public_url?: string;
  media_group_id?: string;
  telegram_data: TelegramMessageData;
  glide_data: Record<string, any>;
  media_metadata: Record<string, any>;
  message_media_data: MessageMediaData;
  vendor_uid?: string;
  purchase_date?: string;
  notes?: string;
  analyzed_content?: Record<string, any>;
  message_url?: string;
  glide_app_url?: string;
  created_at: string;
  updated_at: string;
  telegram_media_row_id?: string;
  product_name?: string;
  product_code?: string;
  quantity?: number;
}

export interface MediaSearchBarProps {
  search: string;
  onSearchChange: (value: string) => void;
}