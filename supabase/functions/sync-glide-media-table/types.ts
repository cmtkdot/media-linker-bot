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
  fileId: { type: "string"; name: "9Bod8" };
  fileUniqueId: { type: "string"; name: "IYnip" };
  fileType: { type: "string"; name: "hbjE4" };
  publicUrl: { type: "uri"; name: "d8Di5" };
  productName: { type: "string"; name: "xGGv3" };
  productCode: { type: "string"; name: "xlfB9" };
  quantity: { type: "number"; name: "TWRwx" };
  telegramData: { type: "string"; name: "Wm1he" };
  glideData: { type: "string"; name: "ZRV7Z" };
  mediaMetadata: { type: "string"; name: "Eu9Zn" };
  processed: { type: "boolean"; name: "oj7fP" };
  processingError: { type: "string"; name: "A4sZX" };
  lastSyncedAt: { type: "string"; name: "PWhCr" };
  createdAt: { type: "string"; name: "Oa3L9" };
  updatedAt: { type: "string"; name: "9xwrl" };
  messageId: { type: "string"; name: "Uzkgt" };
  caption: { type: "string"; name: "pRsjz" };
  vendorUid: { type: "string"; name: "uxDo1" };
  purchaseDate: { type: "date"; name: "AMWxJ" };
  notes: { type: "string"; name: "BkUFO" };
  analyzedContent: { type: "string"; name: "QhAgy" };
  purchaseOrderUid: { type: "string"; name: "3y8Wt" };
  defaultPublicUrl: { type: "uri"; name: "rCJK2" };
  rowId: { type: "string"; name: "rowID" };
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