import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { rowId } = await req.json();
    const GLIDE_API_TOKEN = Deno.env.get('GLIDE_API_TOKEN');

    if (!GLIDE_API_TOKEN) {
      throw new Error('Missing GLIDE_API_TOKEN');
    }

    if (!rowId) {
      throw new Error('Missing rowId parameter');
    }

    console.log('Deleting Glide record:', rowId);

    const response = await fetch('https://api.glideapp.io/api/function/mutateTables', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GLIDE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        appID: 'YOUR_APP_ID',
        mutations: [{
          kind: 'delete-row',
          tableName: 'YOUR_TABLE_NAME',
          rowID: rowId
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to delete Glide record: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Successfully deleted Glide record:', result);

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in delete-glide-record:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});