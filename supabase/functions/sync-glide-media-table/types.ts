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
  message_url?: string;
  chat_url?: string;
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

export interface GlideTableSchema {
  file_id: { name: string; type: string };
  file_unique_id: { name: string; type: string };
  file_type: { name: string; type: string };
  public_url: { name: string; type: string };
  caption: { name: string; type: string };
  product_name: { name: string; type: string };
  product_code: { name: string; type: string };
  quantity: { name: string; type: string };
  vendor_uid: { name: string; type: string };
  purchase_date: { name: string; type: string };
  notes: { name: string; type: string };
  message_url: { name: string; type: string };
  media_group_id: { name: string; type: string };
  created_at: { name: string; type: string };
  updated_at: { name: string; type: string };
}

export const GlideTableSchema: GlideTableSchema = {
  file_id: { name: 'Rt4vA', type: 'string' },
  file_unique_id: { name: 'Rt4vB', type: 'string' },
  file_type: { name: 'Rt4vC', type: 'string' },
  public_url: { name: 'Rt4vD', type: 'string' },
  caption: { name: 'Rt4vE', type: 'string' },
  product_name: { name: 'Rt4vF', type: 'string' },
  product_code: { name: 'Rt4vG', type: 'string' },
  quantity: { name: 'Rt4vH', type: 'number' },
  vendor_uid: { name: 'Rt4vI', type: 'string' },
  purchase_date: { name: 'Rt4vJ', type: 'string' },
  notes: { name: 'Rt4vK', type: 'string' },
  message_url: { name: 'Rt4vL', type: 'string' },
  media_group_id: { name: 'Rt4vM', type: 'string' },
  created_at: { name: 'Rt4vN', type: 'string' },
  updated_at: { name: 'Rt4vO', type: 'string' }
};