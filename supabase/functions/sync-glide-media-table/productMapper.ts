import { GlideMediaRow, SupabaseMediaRow } from './types.ts';

export function mapGlideToSupabase(glideRow: GlideMediaRow): Partial<SupabaseMediaRow> {
  return {
    file_id: glideRow.fileId,
    file_unique_id: glideRow.fileUniqueId,
    file_type: glideRow.fileType,
    public_url: glideRow.publicUrl,
    product_name: glideRow.productName,
    product_code: glideRow.productCode,
    quantity: glideRow.quantity,
    telegram_data: JSON.parse(glideRow.telegramData || '{}'),
    glide_data: JSON.parse(glideRow.glideData || '{}'),
    media_metadata: JSON.parse(glideRow.mediaMetadata || '{}'),
    processed: glideRow.processed,
    processing_error: glideRow.processingError,
    last_synced_at: glideRow.lastSyncedAt,
    created_at: glideRow.createdAt,
    updated_at: glideRow.updatedAt,
    message_id: glideRow.messageId,
    caption: glideRow.caption,
    vendor_uid: glideRow.vendorUid,
    purchase_date: glideRow.purchaseDate,
    notes: glideRow.notes,
    analyzed_content: glideRow.analyzedContent ? JSON.parse(glideRow.analyzedContent) : null,
    purchase_order_uid: glideRow.purchaseOrderUid,
    default_public_url: glideRow.defaultPublicUrl
  };
}

export function mapSupabaseToGlide(supabaseRow: SupabaseMediaRow): Partial<GlideMediaRow> {
  return {
    id: supabaseRow.id,
    fileId: supabaseRow.file_id,
    fileUniqueId: supabaseRow.file_unique_id,
    fileType: supabaseRow.file_type,
    publicUrl: supabaseRow.public_url,
    productName: supabaseRow.product_name,
    productCode: supabaseRow.product_code,
    quantity: supabaseRow.quantity,
    telegramData: JSON.stringify(supabaseRow.telegram_data),
    glideData: JSON.stringify(supabaseRow.glide_data),
    mediaMetadata: JSON.stringify(supabaseRow.media_metadata),
    processed: supabaseRow.processed,
    processingError: supabaseRow.processing_error,
    lastSyncedAt: supabaseRow.last_synced_at,
    createdAt: supabaseRow.created_at,
    updatedAt: supabaseRow.updated_at,
    messageId: supabaseRow.message_id,
    caption: supabaseRow.caption,
    vendorUid: supabaseRow.vendor_uid,
    purchaseDate: supabaseRow.purchase_date,
    notes: supabaseRow.notes,
    analyzedContent: supabaseRow.analyzed_content ? JSON.stringify(supabaseRow.analyzed_content) : null,
    purchaseOrderUid: supabaseRow.purchase_order_uid,
    defaultPublicUrl: supabaseRow.default_public_url
  };
}