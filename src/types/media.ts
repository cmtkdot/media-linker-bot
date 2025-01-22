import { Json } from "@/integrations/supabase/types";

export interface TelegramChat {
  type?: string;
  title?: string;
  id?: number;
  username?: string;
}

export interface TelegramData {
  chat?: TelegramChat;
  message_id?: number;
  chat_id?: number;
  media_group_id?: string;
  date?: number;
  storage_path?: string;
}

export type MediaFileType = 'video' | 'image' | 'document';

export interface MediaItem {
  id: string;
  public_url: string;
  default_public_url: string;
  thumbnail_url?: string;
  file_type: MediaFileType;
  mime_type?: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  caption?: string;
  product_code?: string;
  product_name?: string;
  quantity?: number;
  vendor_uid?: string;
  purchase_date?: string;
  notes?: string;
  message_url?: string;
  chat_url?: string;
  telegram_data?: TelegramData;
  analyzed_content?: {
    text?: string;
    labels?: string[];
    objects?: string[];
  };
  created_at: string;
  updated_at?: string;
}

export interface SupabaseMediaItem {
  id: string;
  public_url: string;
  default_public_url: string;
  thumbnail_url?: string;
  file_type: string;
  mime_type?: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  caption?: string;
  product_code?: string;
  product_name?: string;
  quantity?: number;
  vendor_uid?: string;
  purchase_date?: string;
  notes?: string;
  message_url?: string;
  chat_url?: string;
  telegram_data: Record<string, any>;
  analyzed_content: Record<string, any> | null;
  created_at: string;
  updated_at?: string;
}