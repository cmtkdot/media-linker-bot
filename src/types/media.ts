export type MediaFileType = 'photo' | 'video' | 'document' | 'animation';

export interface TelegramChat {
  id: number;
  title?: string;
  type?: string;
  username?: string;
}

export interface TelegramData {
  message_id: number;
  chat_id: number;
  chat: TelegramChat;
  date: number;
  caption?: string;
  media_group_id?: string;
  message_data?: {
    video?: {
      duration?: number;
      width?: number;
      height?: number;
      thumb?: {
        file_id: string;
        file_unique_id: string;
        width: number;
        height: number;
      };
    };
    photo?: Array<{
      file_id: string;
      file_unique_id: string;
      width: number;
      height: number;
    }>;
  };
  storage_path?: string;
}

export interface GlideData {
  row_id?: string;
  sync_status?: string;
  last_sync?: string;
  [key: string]: unknown;
}

export interface MediaMetadata {
  width?: number;
  height?: number;
  duration?: number;
  thumbnail_path?: string;
  dimensions?: {
    width?: number;
    height?: number;
  };
  thumbnail?: {
    file_id?: string;
    file_unique_id?: string;
    width?: number;
    height?: number;
  };
}

export interface TelegramMessageUpdate {
  caption?: string;
  [key: string]: string | undefined;
}

export interface MediaItem {
  id: string;
  file_id: string;
  file_unique_id: string;
  file_type: 'photo' | 'video' | 'document' | 'animation';
  message_id?: string;
  public_url: string | null;
  default_public_url: string | null;
  thumbnail_url: string | null;
  caption: string | null;
  product_name: string | null;
  product_code: string | null;
  quantity?: number;
  vendor_uid: string | null;
  purchase_date: string | null;
  notes: string | null;
  telegram_data: TelegramData;
  glide_data?: Record<string, unknown>;
  media_metadata: MediaMetadata;
  analyzed_content?: {
    text?: string;
    labels?: string[];
    objects?: string[];
  };
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

export interface QueryResult {
  id: string;
  file_id: string;
  file_unique_id: string;
  file_type: string;
  public_url: string | null;
  default_public_url: string | null;
  thumbnail_url: string | null;
  caption: string | null;
  product_name: string | null;
  product_code: string | null;
  vendor_uid: string | null;
  purchase_date: string | null;
  notes: string | null;
  telegram_data: TelegramData;
  glide_data: GlideData;
  media_metadata: MediaMetadata;
  analyzed_content: {
    text?: string;
    labels?: string[];
    objects?: string[];
  } | null;
  created_at: string;
  updated_at: string;
}
