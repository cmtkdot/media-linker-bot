export interface GlideSyncQueueItem {
  id: string;
  table_name: string;
  record_id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  old_data?: TelegramMedia | null;
  new_data?: TelegramMedia | null;
  created_at?: string | null;
  processed_at?: string | null;
  error?: string | null;
  retry_count?: number;
}

export interface SyncResult {
  added: number;
  updated: number;
  deleted: number;
  errors: string[];
}

export interface GlideConfig {
  id: string;
  app_id: string;
  table_id: string;
  table_name: string;
  api_token: string;
  created_at: string;
  updated_at: string;
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
  created_at: string;
  updated_at: string;
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

export interface GlideMutation {
  kind: 'add-row-to-table' | 'set-columns-in-row' | 'delete-row';
  tableName: string;
  columnValues?: Record<string, any>;
  rowID?: string;
}

export interface GlideApiRequest {
  appID: string;
  mutations: GlideMutation[];
}

export const GlideTableSchema = {
  id: { name: 'UkkMS' },
  file_id: { name: '9Bod8' },
  file_unique_id: { name: 'IYnip' },
  file_type: { name: 'hbjE4' },
  public_url: { name: 'd8Di5' },
  product_name: { name: 'xGGv3' },
  product_code: { name: 'xlfB9' },
  quantity: { name: 'TWRwx' },
  telegram_data: { name: 'Wm1he' },
  glide_data: { name: 'ZRV7Z' },
  media_metadata: { name: 'Eu9Zn' },
  processed: { name: 'oj7fP' },
  processing_error: { name: 'A4sZX' },
  last_synced_at: { name: 'PWhCr' },
  created_at: { name: 'Oa3L9' },
  updated_at: { name: '9xwrl' },
  message_id: { name: 'Uzkgt' },
  caption: { name: 'pRsjz' },
  vendor_uid: { name: 'uxDo1' },
  purchase_date: { name: 'AMWxJ' },
  notes: { name: 'BkUFO' },
  analyzed_content: { name: 'QhAgy' },
  purchase_order_uid: { name: '3y8Wt' },
  default_public_url: { name: 'rCJK2' },
  media_json: { name: 'NL5gM' }
} as const;