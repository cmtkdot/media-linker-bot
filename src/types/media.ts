export type MediaFileType = 'photo' | 'video' | 'document' | 'animation';
export type ThumbnailState = 'pending' | 'downloaded' | 'generated' | 'failed' | 'default';
export type ThumbnailSource = 'telegram' | 'app_generated' | 'media_group' | 'default';

export interface MediaItem {
  id: string;
  file_id: string;
  file_unique_id: string;
  file_type: MediaFileType;
  public_url?: string;
  default_public_url?: string;
  thumbnail_url?: string;
  thumbnail_state?: ThumbnailState;
  thumbnail_source?: ThumbnailSource;
  thumbnail_error?: string;
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
  telegram_media_row_id?: string;
}