import type { TelegramMedia } from '../_shared/types.ts';

export function mapSupabaseToGlide(supabaseRow: TelegramMedia): Record<string, any> {
  return {
    UkkMS: supabaseRow.id,
    '9Bod8': supabaseRow.file_id,
    IYnip: supabaseRow.file_unique_id,
    hbjE4: supabaseRow.file_type,
    d8Di5: supabaseRow.public_url,
    xGGv3: supabaseRow.product_name,
    xlfB9: supabaseRow.product_code,
    TWRwx: supabaseRow.quantity,
    Wm1he: JSON.stringify(supabaseRow.telegram_data),
    ZRV7Z: JSON.stringify(supabaseRow.glide_data),
    Eu9Zn: JSON.stringify(supabaseRow.media_metadata),
    oj7fP: supabaseRow.processed,
    A4sZX: supabaseRow.processing_error,
    PWhCr: supabaseRow.last_synced_at,
    Oa3L9: supabaseRow.created_at,
    '9xwrl': supabaseRow.updated_at,
    Uzkgt: supabaseRow.message_id,
    pRsjz: supabaseRow.caption,
    uxDo1: supabaseRow.vendor_uid,
    AMWxJ: supabaseRow.purchase_date,
    BkUFO: supabaseRow.notes,
    QhAgy: supabaseRow.analyzed_content ? JSON.stringify(supabaseRow.analyzed_content) : null,
    '3y8Wt': supabaseRow.purchase_order_uid,
    rCJK2: supabaseRow.default_public_url,
    NL5gM: supabaseRow.telegram_media_row_id
  };
}

export function mapGlideToSupabase(glideData: Record<string, any>, rowID?: string): Partial<TelegramMedia> {
  return {
    id: glideData.UkkMS,
    file_id: glideData['9Bod8'],
    file_unique_id: glideData.IYnip,
    file_type: glideData.hbjE4,
    public_url: glideData.d8Di5,
    product_name: glideData.xGGv3,
    product_code: glideData.xlfB9,
    quantity: glideData.TWRwx ? Number(glideData.TWRwx) : undefined,
    telegram_data: glideData.Wm1he ? JSON.parse(glideData.Wm1he) : {},
    glide_data: glideData.ZRV7Z ? JSON.parse(glideData.ZRV7Z) : {},
    media_metadata: glideData.Eu9Zn ? JSON.parse(glideData.Eu9Zn) : {},
    processed: glideData.oj7fP === 'true' || glideData.oj7fP === true,
    processing_error: glideData.A4sZX,
    last_synced_at: glideData.PWhCr,
    created_at: glideData.Oa3L9,
    updated_at: glideData['9xwrl'],
    message_id: glideData.Uzkgt,
    caption: glideData.pRsjz,
    vendor_uid: glideData.uxDo1,
    purchase_date: glideData.AMWxJ,
    notes: glideData.BkUFO,
    analyzed_content: glideData.QhAgy ? JSON.parse(glideData.QhAgy) : {},
    purchase_order_uid: glideData['3y8Wt'],
    default_public_url: glideData.rCJK2,
    telegram_media_row_id: rowID || glideData.NL5gM
  };
}