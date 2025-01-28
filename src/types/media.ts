import { MessageMediaData } from './message-media';
import { Json } from "@/integrations/supabase/types";

export interface MediaItem {
  id: string;
  created_at: string;
  updated_at: string;
  
  file_id: string;
  file_unique_id: string;
  file_type: string;
  public_url: string;
  
  message_id: string;
  message_url?: string;
  caption?: string;
  media_group_id?: string;
  
  product_name?: string;
  product_code?: string;
  quantity?: number;
  vendor_uid?: string;
  purchase_date?: string;
  notes?: string;
  
  processed?: boolean;
  processing_error?: string;
  
  analyzed_content: Record<string, any>;
  telegram_data: Record<string, any>;
  message_media_data: MessageMediaData;
  glide_data: Record<string, any>;
  media_metadata: Record<string, any>;
  
  telegram_media_row_id?: string;
  glide_app_url?: string;
  glide_json?: Json;
  last_synced_at?: string;
  message_data?: Json;
  purchase_order_uid?: string;
}
