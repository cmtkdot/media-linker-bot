import { GlideTableSchema, TelegramMedia } from './types.ts';

export function mapSupabaseToGlide(record: TelegramMedia) {
  return {
    [GlideTableSchema.id.name]: record.id,
    [GlideTableSchema.file_id.name]: record.file_id,
    [GlideTableSchema.file_unique_id.name]: record.file_unique_id,
    [GlideTableSchema.file_type.name]: record.file_type,
    [GlideTableSchema.public_url.name]: record.public_url,
    [GlideTableSchema.product_name.name]: record.product_name,
    [GlideTableSchema.product_code.name]: record.product_code,
    [GlideTableSchema.quantity.name]: record.quantity,
    [GlideTableSchema.telegram_data.name]: JSON.stringify(record.telegram_data),
    [GlideTableSchema.glide_data.name]: JSON.stringify(record.glide_data),
    [GlideTableSchema.media_metadata.name]: JSON.stringify(record.media_metadata),
    [GlideTableSchema.processed.name]: record.processed,
    [GlideTableSchema.processing_error.name]: record.processing_error,
    [GlideTableSchema.last_synced_at.name]: record.last_synced_at,
    [GlideTableSchema.created_at.name]: record.created_at,
    [GlideTableSchema.updated_at.name]: record.updated_at,
    [GlideTableSchema.message_id.name]: record.message_id,
    [GlideTableSchema.caption.name]: record.caption,
    [GlideTableSchema.vendor_uid.name]: record.vendor_uid,
    [GlideTableSchema.purchase_date.name]: record.purchase_date,
    [GlideTableSchema.notes.name]: record.notes,
    [GlideTableSchema.analyzed_content.name]: JSON.stringify(record.analyzed_content),
    [GlideTableSchema.purchase_order_uid.name]: record.purchase_order_uid,
    [GlideTableSchema.default_public_url.name]: record.default_public_url,
    [GlideTableSchema.message_url.name]: record.message_url,
    [GlideTableSchema.chat_url.name]: record.chat_url,
    [GlideTableSchema.thumbnail_url.name]: record.thumbnail_url,
    [GlideTableSchema.glide_app_url.name]: record.glide_app_url
  };
}