import { GlideTableSchema, TelegramMedia } from './types.ts';

export function mapSupabaseToGlide(supabaseRow: TelegramMedia): Record<string, any> {
  const mappedData: Record<string, any> = {};

  // Map each field according to the schema
  Object.entries(GlideTableSchema).forEach(([key, field]) => {
    if (key in supabaseRow) {
      const value = supabaseRow[key as keyof TelegramMedia];
      
      // Handle JSON fields by stringifying them
      if (field.type === 'json' && value !== null) {
        mappedData[field.name] = JSON.stringify(value);
      } else {
        mappedData[field.name] = value;
      }
    }
  });

  return mappedData;
}

export function mapGlideToSupabase(glideData: Record<string, any>, rowID?: string): Partial<TelegramMedia> {
  const reverseMapping: Partial<TelegramMedia> = {};
  
  // Create a reverse mapping of Glide column names to Supabase field names
  const reverseSchema = Object.entries(GlideTableSchema).reduce((acc, [key, field]) => {
    acc[field.name] = { key, type: field.type };
    return acc;
  }, {} as Record<string, { key: string; type: string }>);

  // Map Glide data to Supabase format
  Object.entries(glideData).forEach(([glideName, value]) => {
    const mapping = reverseSchema[glideName];
    if (mapping) {
      const { key, type } = mapping;
      
      // Handle JSON fields by parsing them
      if (type === 'json' && typeof value === 'string') {
        try {
          reverseMapping[key as keyof TelegramMedia] = JSON.parse(value);
        } catch (e) {
          console.error(`Error parsing JSON for field ${key}:`, e);
          reverseMapping[key as keyof TelegramMedia] = null;
        }
      } else {
        reverseMapping[key as keyof TelegramMedia] = value;
      }
    }
  });

  // Add the Glide row ID if provided
  if (rowID) {
    reverseMapping.telegram_media_row_id = rowID;
  }

  return reverseMapping;
}