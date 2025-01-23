export type MediaFileType = 'photo' | 'video' | 'document' | 'animation';

export interface MediaItem {
  id: string;
  file_id: string;
  file_unique_id: string;
  file_type: MediaFileType;
  public_url?: string;
  default_public_url?: string;
  thumbnail_url?: string;
  product_name?: string;
  product_code?: string;
  quantity?: number;
  telegram_data: Record<string, any>;
  glide_data: Record<string, any>;
  media_metadata: Record<string, any>;
  caption?: string;
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
  telegram_media_row_id?: string;
  created_at: string;
  updated_at: string;
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

export interface TelegramData {
  chat?: {
    title?: string;
  };
  message_data?: {
    video?: {
      thumb?: {
        file_id: string;
        file_unique_id: string;
        width: number;
        height: number;
      };
    };
  };
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
  dimensions?: Record<string, unknown>;
  thumbnail?: Record<string, unknown>;
  [key: string]: unknown;
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
