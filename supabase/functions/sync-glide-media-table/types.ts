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
  message_url?: string;
  chat_url?: string;
  thumbnail_url?: string;
  glide_app_url?: string;
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
  id: { name: 'UkkMS', type: 'string' },
  file_id: { name: '9Bod8', type: 'string' },
  file_unique_id: { name: 'IYnip', type: 'string' },
  file_type: { name: 'hbjE4', type: 'string' },
  public_url: { name: 'd8Di5', type: 'string' },
  product_name: { name: 'xGGv3', type: 'string' },
  product_code: { name: 'xlfB9', type: 'string' },
  quantity: { name: 'TWRwx', type: 'number' },
  telegram_data: { name: 'Wm1he', type: 'json' },
  glide_data: { name: 'ZRV7Z', type: 'json' },
  media_metadata: { name: 'Eu9Zn', type: 'json' },
  processed: { name: 'oj7fP', type: 'boolean' },
  processing_error: { name: 'A4sZX', type: 'string' },
  last_synced_at: { name: 'PWhCr', type: 'string' },
  created_at: { name: 'Oa3L9', type: 'string' },
  updated_at: { name: '9xwrl', type: 'string' },
  message_id: { name: 'Uzkgt', type: 'string' },
  caption: { name: 'pRsjz', type: 'string' },
  vendor_uid: { name: 'uxDo1', type: 'string' },
  purchase_date: { name: 'AMWxJ', type: 'string' },
  notes: { name: 'BkUFO', type: 'string' },
  analyzed_content: { name: 'QhAgy', type: 'json' },
  purchase_order_uid: { name: '3y8Wt', type: 'string' },
  default_public_url: { name: 'rCJK2', type: 'string' },
  telegram_media_row_id: { name: 'NL5gM', type: 'string' },
  message_url: { name: 'KjP2m', type: 'string' },
  chat_url: { name: 'Lm3nQ', type: 'string' },
  thumbnail_url: { name: 'Rt4vX', type: 'string' },
  glide_app_url: { name: 'Yx9Kp', type: 'string' },
};