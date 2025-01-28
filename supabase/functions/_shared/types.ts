import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Database type for Supabase client
export type Database = {
  public: {
    Tables: {
      messages: {
        Row: any; // Replace with actual message table type
      };
      telegram_media: {
        Row: TelegramMedia;
      };
      media_processing_logs: {
        Row: any; // Replace with actual log table type
      };
    };
  };
};

export type SupabaseClientWithDatabase = SupabaseClient<Database>;

export interface GlideSyncQueueItem {
  id: string;
  table_name: string;
  record_id: string;
  operation: "INSERT" | "UPDATE" | "DELETE";
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

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface TelegramMedia {
  id: string;
  file_id: string;
  file_unique_id: string;
  file_type: string;
  public_url?: string;
  storage_path?: string;
  product_name?: string;
  product_code?: string;
  quantity?: number;
  telegram_data: Record<string, JsonValue>;
  glide_data: Record<string, JsonValue>;
  media_metadata: Record<string, JsonValue>;
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
  analyzed_content?: Record<string, JsonValue>;
  purchase_order_uid?: string;
  default_public_url?: string;
  telegram_media_row_id?: string;
}

export interface GlideMutation {
  kind: "add-row-to-table" | "set-columns-in-row" | "delete-row";
  tableName: string;
  columnValues?: {
    UkkMS?: string; // id
    "9Bod8"?: string; // file_id
    IYnip?: string; // file_unique_id
    hbjE4?: string; // file_type
    d8Di5?: string; // public_url
    xGGv3?: string; // product_name
    xlfB9?: string; // product_code
    TWRwx?: number; // quantity
    Wm1he?: string; // telegram_data (stringified)
    ZRV7Z?: string; // glide_data (stringified)
    Eu9Zn?: string; // media_metadata (stringified)
    oj7fP?: boolean; // processed
    A4sZX?: string; // processing_error
    PWhCr?: string; // last_synced_at
    Oa3L9?: string; // created_at
    "9xwrl"?: string; // updated_at
    Uzkgt?: string; // message_id
    pRsjz?: string; // caption
    uxDo1?: string; // vendor_uid
    AMWxJ?: string; // purchase_date
    BkUFO?: string; // notes
    QhAgy?: string; // analyzed_content (stringified)
    "3y8Wt"?: string; // purchase_order_uid
    rCJK2?: string; // default_public_url
    NL5gM?: string; // media_json (stringified)
  };
  rowID?: string;
}

export interface GlideApiRequest {
  appID: string;
  mutations: GlideMutation[];
}

export interface GlideColumnMapping {
  name: string;
  type?: "string" | "number" | "boolean" | "json";
}

export interface GlideTableSchemaType {
  id: GlideColumnMapping;
  file_id: GlideColumnMapping;
  file_unique_id: GlideColumnMapping;
  file_type: GlideColumnMapping;
  public_url: GlideColumnMapping;
  product_name: GlideColumnMapping;
  product_code: GlideColumnMapping;
  quantity: GlideColumnMapping;
  telegram_data: GlideColumnMapping;
  glide_data: GlideColumnMapping;
  media_metadata: GlideColumnMapping;
  processed: GlideColumnMapping;
  processing_error: GlideColumnMapping;
  last_synced_at: GlideColumnMapping;
  created_at: GlideColumnMapping;
  updated_at: GlideColumnMapping;
  message_id: GlideColumnMapping;
  caption: GlideColumnMapping;
  vendor_uid: GlideColumnMapping;
  purchase_date: GlideColumnMapping;
  notes: GlideColumnMapping;
  analyzed_content: GlideColumnMapping;
  purchase_order_uid: GlideColumnMapping;
  default_public_url: GlideColumnMapping;
  media_json: GlideColumnMapping;
}

export const GlideTableSchema: GlideTableSchemaType = {
  id: { name: "UkkMS", type: "string" },
  file_id: { name: "9Bod8", type: "string" },
  file_unique_id: { name: "IYnip", type: "string" },
  file_type: { name: "hbjE4", type: "string" },
  public_url: { name: "d8Di5", type: "string" },
  product_name: { name: "xGGv3", type: "string" },
  product_code: { name: "xlfB9", type: "string" },
  quantity: { name: "TWRwx", type: "number" },
  telegram_data: { name: "Wm1he", type: "json" },
  glide_data: { name: "ZRV7Z", type: "json" },
  media_metadata: { name: "Eu9Zn", type: "json" },
  processed: { name: "oj7fP", type: "boolean" },
  processing_error: { name: "A4sZX", type: "string" },
  last_synced_at: { name: "PWhCr", type: "string" },
  created_at: { name: "Oa3L9", type: "string" },
  updated_at: { name: "9xwrl", type: "string" },
  message_id: { name: "Uzkgt", type: "string" },
  caption: { name: "pRsjz", type: "string" },
  vendor_uid: { name: "uxDo1", type: "string" },
  purchase_date: { name: "AMWxJ", type: "string" },
  notes: { name: "BkUFO", type: "string" },
  analyzed_content: { name: "QhAgy", type: "json" },
  purchase_order_uid: { name: "3y8Wt", type: "string" },
  default_public_url: { name: "rCJK2", type: "string" },
  media_json: { name: "NL5gM", type: "json" },
};

export interface GlideApiResponse {
  rowID?: string;
  Row_ID?: string;
  Row_Id?: string;
  row_id?: string;
  [key: string]: unknown;
}
