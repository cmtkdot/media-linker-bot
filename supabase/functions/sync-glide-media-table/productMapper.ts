import { GlideTableSchema } from './types.ts';

export function mapRecordToGlide(record: any) {
  return {
    [GlideTableSchema.file_id.name]: record.file_id,
    [GlideTableSchema.file_unique_id.name]: record.file_unique_id,
    [GlideTableSchema.file_type.name]: record.file_type,
    [GlideTableSchema.public_url.name]: record.public_url,
    [GlideTableSchema.caption.name]: record.caption,
    [GlideTableSchema.product_name.name]: record.product_name,
    [GlideTableSchema.product_code.name]: record.product_code,
    [GlideTableSchema.quantity.name]: record.quantity,
    [GlideTableSchema.vendor_uid.name]: record.vendor_uid,
    [GlideTableSchema.purchase_date.name]: record.purchase_date,
    [GlideTableSchema.notes.name]: record.notes,
    [GlideTableSchema.message_url.name]: record.message_url,
    [GlideTableSchema.media_group_id.name]: record.media_group_id,
    [GlideTableSchema.created_at.name]: record.created_at,
    [GlideTableSchema.updated_at.name]: record.updated_at,
    [GlideTableSchema.analyzed_content.name]: JSON.stringify(record.analyzed_content),
    [GlideTableSchema.telegram_data.name]: JSON.stringify(record.telegram_data),
    [GlideTableSchema.glide_data.name]: JSON.stringify(record.glide_data),
    [GlideTableSchema.media_metadata.name]: JSON.stringify(record.media_metadata)
  };
}