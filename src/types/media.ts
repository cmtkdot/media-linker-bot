export interface MediaItem {
  id: string;
  public_url: string;
  default_public_url: string;
  file_type: string;
  caption?: string;
  product_code?: string;
  product_name?: string;
  quantity?: number;
  vendor_uid?: string;
  purchase_date?: string;
  notes?: string;
  telegram_data?: {
    chat?: {
      type?: string;
      title?: string;
      id?: number;
    };
    message_id?: number;
    chat_id?: number;
  };
  created_at: string;
}