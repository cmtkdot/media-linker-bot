import type { GlideTableSchema, TelegramMedia } from './types.ts';

export function mapSupabaseToGlide(supabaseRow: TelegramMedia): Record<string, any> {
  const schema = GlideTableSchema;
  const mappedData: Record<string, any> = {};

  // Map each field according to the schema
  Object.entries(schema).forEach(([key, field]) => {
    if (key in supabaseRow) {
      mappedData[field.name] = supabaseRow[key as keyof TelegramMedia];
    }
  });

  return mappedData;
}

export function mapGlideToSupabase(glideData: Record<string, any>, rowID?: string): Partial<TelegramMedia> {
  const schema = GlideTableSchema;
  
  return {
    file_id: glideData[schema.file_id.name],
    file_unique_id: glideData[schema.file_unique_id.name],
    file_type: glideData[schema.file_type.name],
    public_url: glideData[schema.public_url.name],
    product_name: glideData[schema.product_name.name],
    product_code: glideData[schema.product_code.name],
    quantity: glideData[schema.quantity.name],
    vendor_uid: glideData[schema.vendor_uid.name],
    purchase_date: glideData[schema.purchase_date.name],
    notes: glideData[schema.notes.name],
    default_public_url: glideData[schema.default_public_url.name],
    telegram_media_row_id: rowID
  };
}