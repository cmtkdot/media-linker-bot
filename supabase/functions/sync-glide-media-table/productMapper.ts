import type { TelegramMedia } from '../_shared/types.ts';

export function mapSupabaseToGlide(supabaseRow: TelegramMedia): Record<string, any> {
  // Map directly to column names without schema transformation
  return {
    id: supabaseRow.id,
    file_id: supabaseRow.file_id,
    file_unique_id: supabaseRow.file_unique_id,
    file_type: supabaseRow.file_type,
    public_url: supabaseRow.public_url,
    product_name: supabaseRow.product_name,
    product_code: supabaseRow.product_code,
    quantity: supabaseRow.quantity,
    telegram_data: JSON.stringify(supabaseRow.telegram_data),
    glide_data: JSON.stringify(supabaseRow.glide_data),
    media_metadata: JSON.stringify(supabaseRow.media_metadata),
    processed: supabaseRow.processed,
    processing_error: supabaseRow.processing_error,
    last_synced_at: supabaseRow.last_synced_at,
    created_at: supabaseRow.created_at,
    updated_at: supabaseRow.updated_at,
    message_id: supabaseRow.message_id,
    caption: supabaseRow.caption,
    vendor_uid: supabaseRow.vendor_uid,
    purchase_date: supabaseRow.purchase_date,
    notes: supabaseRow.notes,
    analyzed_content: JSON.stringify(supabaseRow.analyzed_content),
    purchase_order_uid: supabaseRow.purchase_order_uid,
    default_public_url: supabaseRow.default_public_url,
    telegram_media_row_id: supabaseRow.telegram_media_row_id
  };
}

export function mapGlideToSupabase(glideData: Record<string, any>, rowID?: string): Partial<TelegramMedia> {
  return {
    id: glideData.id,
    file_id: glideData.file_id,
    file_unique_id: glideData.file_unique_id,
    file_type: glideData.file_type,
    public_url: glideData.public_url,
    product_name: glideData.product_name,
    product_code: glideData.product_code,
    quantity: glideData.quantity ? Number(glideData.quantity) : undefined,
    telegram_data: glideData.telegram_data ? JSON.parse(glideData.telegram_data) : {},
    glide_data: glideData.glide_data ? JSON.parse(glideData.glide_data) : {},
    media_metadata: glideData.media_metadata ? JSON.parse(glideData.media_metadata) : {},
    processed: glideData.processed === 'true',
    processing_error: glideData.processing_error,
    last_synced_at: glideData.last_synced_at,
    created_at: glideData.created_at,
    updated_at: glideData.updated_at,
    message_id: glideData.message_id,
    caption: glideData.caption,
    vendor_uid: glideData.vendor_uid,
    purchase_date: glideData.purchase_date,
    notes: glideData.notes,
    analyzed_content: glideData.analyzed_content ? JSON.parse(glideData.analyzed_content) : {},
    purchase_order_uid: glideData.purchase_order_uid,
    default_public_url: glideData.default_public_url,
    telegram_media_row_id: rowID || glideData.telegram_media_row_id
  };
}