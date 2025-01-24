import { Json } from "@/integrations/supabase/types";

export interface TelegramPhotoSize {
  width: number;
  height: number;
  file_id: string;
  file_size: number;
  file_unique_id: string;
}

export interface TelegramChat {
  id: number;
  type: string;
  title: string;
}

export interface TelegramMessageData {
  chat: TelegramChat;
  date: number;
  photo?: TelegramPhotoSize[];
  video?: {
    file_id: string;
    file_unique_id: string;
    width: number;
    height: number;
    duration: number;
    thumb?: TelegramPhotoSize;
    file_name?: string;
    mime_type?: string;
    file_size?: number;
  };
  message_id: number;
  sender_chat?: TelegramChat;
  media_group_id?: string;
  caption?: string;
}

export interface MessageInfo {
  url?: string;
  media_group_id?: string;
  caption?: string;
  message_id: number;
  chat_id: number;
  date: number;
}

export interface SenderInfo {
  sender_info: Record<string, any>;
  chat_info: Record<string, any>;
}

export interface AnalysisInfo {
  analyzed_content: Record<string, any>;
}

export interface MessageMetadata {
  created_at: string;
  updated_at: string;
  status: 'pending' | 'processed' | 'error';
  error?: string | null;
}

export interface MessageMediaData {
  message: MessageInfo;
  sender: SenderInfo;
  analysis: AnalysisInfo;
  meta: MessageMetadata;
}

export interface MediaItem {
  id: string;
  file_id: string;
  file_unique_id: string;
  file_type: 'photo' | 'video' | 'document' | 'animation';
  public_url?: string;
  default_public_url?: string;
  thumbnail_url?: string;
  thumbnail_state?: 'pending' | 'downloaded' | 'generated' | 'failed' | 'default';
  thumbnail_source?: 'telegram' | 'app_generated' | 'media_group' | 'default';
  thumbnail_error?: string;
  product_name?: string;
  product_code?: string;
  quantity?: number;
  caption?: string;
  media_group_id?: string;
  storage_path?: string;
  telegram_data: {
    message_data: TelegramMessageData;
    [key: string]: any;
  };
  glide_data: Record<string, any>;
  media_metadata: Record<string, any>;
  message_media_data: MessageMediaData;
  vendor_uid?: string;
  purchase_date?: string;
  notes?: string;
  analyzed_content?: {
    text: string;
    labels: string[];
    objects: string[];
  };
  message_url?: string;
  glide_app_url?: string;
  created_at: string;
  updated_at: string;
  telegram_media_row_id?: string;
}

export interface MediaSearchBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  view: 'grid' | 'table';
  onViewChange: (view: 'grid' | 'table') => void;
  selectedChannel: string;
  onChannelChange: (channel: string) => void;
  selectedType: string;
  onTypeChange: (type: string) => void;
  selectedVendor: string;
  onVendorChange: (vendor: string) => void;
  selectedSort: string;
  onSortChange: (sort: string) => void;
  channels: string[];
  vendors: string[];
}