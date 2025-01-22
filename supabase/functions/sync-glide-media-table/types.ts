export interface SyncResult {
  added: number;
  updated: number;
  deleted: number;
  errors: string[];
}

export interface GlideResponse {
  rowIDs?: string[];
  error?: string;
}

export interface GlideTableSchema {
  id: { type: "string"; name: "UkkMS" };
  file_id: { type: "string"; name: "9Bod8" };
  file_unique_id: { type: "string"; name: "IYnip" };
  file_type: { type: "string"; name: "hbjE4" };
  public_url: { type: "uri"; name: "d8Di5" };
  product_name: { type: "string"; name: "xGGv3" };
  product_code: { type: "string"; name: "xlfB9" };
  quantity: { type: "number"; name: "TWRwx" };
  telegram_data: { type: "string"; name: "Wm1he" };
  glide_data: { type: "string"; name: "ZRV7Z" };
  media_metadata: { type: "string"; name: "Eu9Zn" };
  processed: { type: "boolean"; name: "oj7fP" };
  processing_error: { type: "string"; name: "A4sZX" };
  last_synced_at: { type: "string"; name: "PWhCr" };
  created_at: { type: "string"; name: "Oa3L9" };
  updated_at: { type: "string"; name: "9xwrl" };
  message_id: { type: "string"; name: "Uzkgt" };
  caption: { type: "string"; name: "pRsjz" };
  vendor_uid: { type: "string"; name: "uxDo1" };
  purchase_date: { type: "date"; name: "AMWxJ" };
  notes: { type: "string"; name: "BkUFO" };
  analyzed_content: { type: "string"; name: "QhAgy" };
  purchase_order_uid: { type: "string"; name: "3y8Wt" };
  default_public_url: { type: "uri"; name: "rCJK2" };
  telegram_media_row_id: { type: "string"; name: "rowID" };
  media_json: { type: "string"; name: "NL5gM" };
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

export interface GlideSyncQueueItem {
  id: string;
  table_name: string;
  record_id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  old_data?: Record<string, any>;
  new_data?: Record<string, any>;
  created_at?: string;
  processed_at?: string | null;
  error?: string | null;
  retry_count?: number;
}