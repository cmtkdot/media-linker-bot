export interface GlideConfig {
  app_id: string;
  table_id: string;
  table_name: string;
  api_token: string;
  supabase_table_name: string | null;
  active: boolean;
}

export interface GlideMediaRow {
  id: string;
  fileId: string;
  fileUniqueId: string;
  fileType: string;
  publicUrl: string | null;
  productName: string | null;
  productCode: string | null;
  quantity: number | null;
  telegramData: string;
  glideData: string;
  mediaMetadata: string;
  processed: boolean;
  processingError: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
  messageId: string | null;
  caption: string | null;
  vendorUid: string | null;
  purchaseDate: string | null;
  notes: string | null;
  analyzedContent: string | null;
  purchaseOrderUid: string | null;
  defaultPublicUrl: string | null;
}

export interface SupabaseMediaRow {
  id: string;
  file_id: string;
  file_unique_id: string;
  file_type: string;
  public_url: string | null;
  product_name: string | null;
  product_code: string | null;
  quantity: number | null;
  telegram_data: Record<string, any>;
  glide_data: Record<string, any>;
  media_metadata: Record<string, any>;
  processed: boolean;
  processing_error: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
  message_id: string | null;
  caption: string | null;
  vendor_uid: string | null;
  purchase_date: string | null;
  notes: string | null;
  analyzed_content: Record<string, any> | null;
  purchase_order_uid: string | null;
  default_public_url: string | null;
}

export interface SyncResult {
  added: number;
  updated: number;
  deleted: number;
  errors?: string[];
}