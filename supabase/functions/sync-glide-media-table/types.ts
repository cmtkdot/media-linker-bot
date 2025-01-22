export interface GlideMutation {
  kind: 'add-row-to-table' | 'set-columns-in-row' | 'delete-row';
  tableName: string;
  rowID?: string;
  columnValues?: Record<string, any>;
}

export interface GlideApiRequest {
  appID: string;
  mutations: GlideMutation[];
}

export interface GlideApiResponse {
  rowID?: string;
  Row_ID?: string;
  Row_Id?: string;
  row_id?: string;
}

export interface GlideConfig {
  id: string;
  app_id: string;
  table_id: string;
  table_name: string;
  api_token: string;
  active: boolean;
  supabase_table_name: string;
}

export interface TelegramMedia {
  id: string;
  file_id: string;
  file_unique_id: string;
  file_type: string;
  public_url?: string;
  product_name?: string;
  product_code?: string;
  quantity?: number;
  telegram_data: Record<string, any>;
  glide_data: Record<string, any>;
  media_metadata: Record<string, any>;
  processed?: boolean;
  processing_error?: string;
  last_synced_at?: string;
  message_id?: string;
  caption?: string;
  vendor_uid?: string;
  purchase_date?: string;
  notes?: string;
  analyzed_content?: Record<string, any>;
  purchase_order_uid?: string;
  default_public_url?: string;
  telegram_media_row_id?: string;
}

export interface GlideSyncQueueItem {
  id: string;
  table_name: string;
  record_id: string;
  operation: string;
  old_data?: Record<string, any>;
  new_data?: Record<string, any>;
  created_at?: string;
  processed_at?: string;
  error?: string;
  retry_count?: number;
}

export const GlideTableSchema = {
  file_id: { name: 'file_id', type: 'text' },
  file_unique_id: { name: 'file_unique_id', type: 'text' },
  file_type: { name: 'file_type', type: 'text' },
  public_url: { name: 'public_url', type: 'text' },
  product_name: { name: 'product_name', type: 'text' },
  product_code: { name: 'product_code', type: 'text' },
  quantity: { name: 'quantity', type: 'number' },
  vendor_uid: { name: 'vendor_uid', type: 'text' },
  purchase_date: { name: 'purchase_date', type: 'date' },
  notes: { name: 'notes', type: 'text' },
  default_public_url: { name: 'default_public_url', type: 'text' },
  telegram_media_row_id: { name: 'telegram_media_row_id', type: 'text' }
};