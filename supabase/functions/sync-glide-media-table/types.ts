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

export interface SyncResult {
  synced_count: number;
  error_count: number;
}

export interface GlideColumnMapping {
  name: string;
  type?: 'string' | 'number' | 'boolean' | 'json';
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
  media_json: { name: 'NL5gM', type: 'json' }
};