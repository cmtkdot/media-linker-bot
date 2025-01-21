export interface SyncResult {
  added: number;
  updated: number;
  deleted: number;
  errors: string[];
}

export interface GlideTableSchema {
  id: { type: "string"; name: "6u01A" };
  fileType: { type: "string"; name: "kprTT" };
  publicUrl: { type: "uri"; name: "OhnPo" };
  productName: { type: "string"; name: "iCMpt" };
  productCode: { type: "string"; name: "3enHP" };
  quantity: { type: "number"; name: "JCd9X" };
  lastSyncedAt: { type: "string"; name: "WHOJ6" };
  caption: { type: "string"; name: "YlID9" };
  vendorUid: { type: "string"; name: "0Z5ka" };
  purchaseDate: { type: "date"; name: "Gfmqg" };
  notes: { type: "string"; name: "4yF1H" };
  analyzedContent: { type: "string"; name: "c2o7S" };
  purchaseOrderUid: { type: "string"; name: "Ve1EB" };
  defaultPublicUrl: { type: "uri"; name: "XIJQs" };
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
  caption?: string;
  vendor_uid?: string;
  purchase_date?: string;
  notes?: string;
  analyzed_content?: Record<string, any>;
  purchase_order_uid?: string;
  default_public_url?: string;
  telegram_media_row_id?: string;
}

export interface GlideResponse {
  rowIDs?: string[];
  error?: string;
}