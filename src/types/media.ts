export interface MediaItem {
  id: string;
  file_id: string;
  file_unique_id: string;
  file_type: 'photo' | 'video' | 'document' | 'animation';
  public_url: string | null;
  default_public_url: string | null;
  thumbnail_url: string | null;
  caption: string | null;
  product_name: string | null;
  product_code: string | null;
  vendor_uid: string | null;
  purchase_date: string | null;
  notes: string | null;
  telegram_data: Record<string, any>;
  glide_data: Record<string, any>;
  media_metadata: Record<string, any>;
  analyzed_content?: {
    text?: string;
    labels?: string[];
    objects?: string[];
  };
  relatedMedia?: MediaItem[];
}