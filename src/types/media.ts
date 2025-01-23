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
  created_at: string;
  updated_at: string;
}

export interface SupabaseMediaItem extends Omit<MediaItem, 'file_type' | 'telegram_data' | 'glide_data' | 'media_metadata' | 'analyzed_content'> {
  file_type: string;
  telegram_data: any;
  glide_data: any;
  media_metadata: any;
  analyzed_content?: any;
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
  channels: string[];
  vendors: string[];
}