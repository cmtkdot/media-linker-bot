import { GlideTableSchema } from './types.ts';
import type { TelegramMedia } from './types.ts';

export function mapSupabaseToGlide(supabaseRow: TelegramMedia): Record<string, any> {
  const mappedData: Record<string, any> = {};

  // Map each field according to the schema
  Object.entries(GlideTableSchema).forEach(([key, field]) => {
    if (key in supabaseRow) {
      let value = supabaseRow[key as keyof TelegramMedia];
      
      // Handle JSON fields that need to be stringified
      if (field.type === 'string' && typeof value === 'object') {
        value = JSON.stringify(value);
      }
      
      mappedData[field.name] = value;
    }
  });

  return mappedData;
}

export function mapGlideToSupabase(glideData: Record<string, any>, rowID?: string): Partial<TelegramMedia> {
  const supabaseData: Partial<TelegramMedia> = {};
  
  Object.entries(GlideTableSchema).forEach(([key, field]) => {
    if (glideData[field.name] !== undefined) {
      let value = glideData[field.name];
      
      // Handle JSON fields that need to be parsed
      if (field.type === 'string' && typeof value === 'string' && (
        key === 'telegram_data' || 
        key === 'glide_data' || 
        key === 'media_metadata' || 
        key === 'analyzed_content'
      )) {
        try {
          value = JSON.parse(value);
        } catch (e) {
          console.error(`Error parsing JSON for field ${key}:`, e);
          value = {};
        }
      }
      
      supabaseData[key as keyof TelegramMedia] = value;
    }
  });

  if (rowID) {
    supabaseData.telegram_media_row_id = rowID;
  }

  return supabaseData;
}