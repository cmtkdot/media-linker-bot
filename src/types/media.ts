export type MediaFileType = 'photo' | 'video' | 'document' | 'animation';
export type ThumbnailState = 'pending' | 'downloaded' | 'generated' | 'failed' | 'default';
export type ThumbnailSource = 'telegram' | 'app_generated' | 'media_group' | 'default';

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
  message_media_data: MessageMediaData;
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