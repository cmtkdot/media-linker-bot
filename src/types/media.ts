export interface MediaItem {
  id: string;
  public_url: string;
  file_type: string;
  caption?: string;
  product_code?: string;
  product_name?: string;
  quantity?: number;
  vendor_uid?: string;
  purchase_date?: string;
  notes?: string;
  created_at: string;
  telegram_data?: any;
  message_id?: string;
}