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