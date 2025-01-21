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
  telegramMediaRowId: { type: "string"; name: "KmP9x" };
}

export interface GlideRecord {
  [key: string]: any;
}