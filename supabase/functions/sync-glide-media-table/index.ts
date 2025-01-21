import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from '@supabase/supabase-js';
import { GlideClient } from '@glideapps/tables';

// CORS headers for browser access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IdMapping {
  supabase_id: string;
  glide_row_id: string;
}

interface SyncResult {
  added: number;
  updated: number;
  deleted: number;
  errors: string[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const GLIDE_API_TOKEN = Deno.env.get('GLIDE_API_TOKEN');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !GLIDE_API_TOKEN) {
      throw new Error('Missing required environment variables');
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Initialize Glide client
    const glide = new GlideClient(GLIDE_API_TOKEN);
    const table = glide.table('telegram_media');

    // Store mapping of IDs
    const idMap = new Map<string, string>();

    // Function to build initial ID mapping
    async function buildIdMapping(): Promise<Map<string, string>> {
      console.log('Building initial ID mapping...');
      const mapping = new Map<string, string>();
      
      try {
        // Get all rows from Glide
        const glideRows = await table.rows();
        
        // Build mapping
        for (const row of glideRows) {
          const supabaseId = row.get('id') as string;
          const glideRowId = row.rowId;
          if (supabaseId && glideRowId) {
            mapping.set(supabaseId, glideRowId);
          }
        }
        
        console.log(`Built mapping with ${mapping.size} entries`);
        return mapping;
      } catch (error) {
        console.error('Error building ID mapping:', error);
        throw error;
      }
    }

    // Function to sync Supabase changes to Glide
    async function syncToGlide(changes: any[]): Promise<SyncResult> {
      console.log('Syncing changes to Glide:', changes);
      const result: SyncResult = { added: 0, updated: 0, deleted: 0, errors: [] };

      try {
        for (const change of changes) {
          const { eventType, old: oldRecord, new: newRecord } = change;

          switch (eventType) {
            case 'INSERT': {
              try {
                const row = await table.addRow({
                  id: newRecord.id,
                  file_id: newRecord.file_id,
                  file_unique_id: newRecord.file_unique_id,
                  file_type: newRecord.file_type,
                  public_url: newRecord.public_url,
                  caption: newRecord.caption,
                  // Add other fields as needed
                });
                idMap.set(newRecord.id, row.rowId);
                result.added++;
              } catch (error) {
                result.errors.push(`Insert error for ${newRecord.id}: ${error.message}`);
              }
              break;
            }
            case 'UPDATE': {
              const glideRowId = idMap.get(newRecord.id);
              if (glideRowId) {
                try {
                  await table.updateRow(glideRowId, {
                    file_id: newRecord.file_id,
                    file_unique_id: newRecord.file_unique_id,
                    file_type: newRecord.file_type,
                    public_url: newRecord.public_url,
                    caption: newRecord.caption,
                    // Add other fields as needed
                  });
                  result.updated++;
                } catch (error) {
                  result.errors.push(`Update error for ${newRecord.id}: ${error.message}`);
                }
              }
              break;
            }
            case 'DELETE': {
              const glideRowId = idMap.get(oldRecord.id);
              if (glideRowId) {
                try {
                  await table.deleteRow(glideRowId);
                  idMap.delete(oldRecord.id);
                  result.deleted++;
                } catch (error) {
                  result.errors.push(`Delete error for ${oldRecord.id}: ${error.message}`);
                }
              }
              break;
            }
          }
        }
      } catch (error) {
        console.error('Error in syncToGlide:', error);
        throw error;
      }

      return result;
    }

    // Function to sync Glide changes to Supabase
    async function syncFromGlide(): Promise<SyncResult> {
      console.log('Checking for Glide changes...');
      const result: SyncResult = { added: 0, updated: 0, deleted: 0, errors: [] };

      try {
        // Get all rows from both systems
        const glideRows = await table.rows();
        const { data: supabaseRows, error } = await supabase
          .from('telegram_media')
          .select('*');

        if (error) throw error;

        // Create maps for easy lookup
        const glideMap = new Map(glideRows.map(row => [row.get('id') as string, row]));
        const supabaseMap = new Map(supabaseRows.map(row => [row.id, row]));

        // Handle new and updated rows in Glide
        for (const [id, glideRow] of glideMap) {
          const supabaseRow = supabaseMap.get(id);
          const rowData = {
            id,
            file_id: glideRow.get('file_id'),
            file_unique_id: glideRow.get('file_unique_id'),
            file_type: glideRow.get('file_type'),
            public_url: glideRow.get('public_url'),
            caption: glideRow.get('caption'),
            // Add other fields as needed
          };

          if (!supabaseRow) {
            // New row in Glide
            try {
              await supabase.from('telegram_media').insert([rowData]);
              result.added++;
            } catch (error) {
              result.errors.push(`Insert error for ${id}: ${error.message}`);
            }
          } else {
            // Existing row - check for updates
            try {
              await supabase
                .from('telegram_media')
                .update(rowData)
                .eq('id', id);
              result.updated++;
            } catch (error) {
              result.errors.push(`Update error for ${id}: ${error.message}`);
            }
          }
        }

        // Handle deletions in Glide
        for (const [id, supabaseRow] of supabaseMap) {
          if (!glideMap.has(id)) {
            try {
              await supabase
                .from('telegram_media')
                .delete()
                .eq('id', id);
              result.deleted++;
            } catch (error) {
              result.errors.push(`Delete error for ${id}: ${error.message}`);
            }
          }
        }

        return result;
      } catch (error) {
        console.error('Error in syncFromGlide:', error);
        throw error;
      }
    }

    // Handle different sync operations based on request
    const { operation } = await req.json();
    let result;

    switch (operation) {
      case 'buildMapping':
        result = await buildIdMapping();
        break;
      case 'syncToGlide':
        const { changes } = await req.json();
        result = await syncToGlide(changes);
        break;
      case 'syncFromGlide':
        result = await syncFromGlide();
        break;
      default:
        throw new Error('Invalid operation');
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    console.error('Error in sync operation:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});
