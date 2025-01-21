import { corsHeaders } from './cors.ts';

interface GlideRecord {
  id: string;
  telegram_media_row_id?: string;
  [key: string]: any;
}

export async function fetchGlideRecords(tableId: string): Promise<GlideRecord[]> {
  const apiToken = Deno.env.get('GLIDE_API_TOKEN')?.trim();
  if (!apiToken) {
    throw new Error('GLIDE_API_TOKEN is not set in Edge Function secrets');
  }

  console.log('Making request to Glide API with token:', {
    token_length: apiToken.length,
    token_preview: `${apiToken.substring(0, 5)}...${apiToken.substring(apiToken.length - 5)}`
  });

  const glideResponse = await fetch(
    `https://api.glideapp.io/api/tables/${encodeURIComponent(tableId)}/rows`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json; charset=utf-8',
        'Accept': 'application/json; charset=utf-8',
      },
    }
  );

  if (!glideResponse.ok) {
    const errorText = await glideResponse.text();
    const errorDetails = {
      status: glideResponse.status,
      statusText: glideResponse.statusText,
      error: errorText,
      config: {
        table_id: tableId,
        has_token: true,
        token_length: apiToken.length,
        auth_header_preview: `Bearer ${apiToken.substring(0, 5)}...${apiToken.substring(apiToken.length - 5)}`
      }
    };
    
    console.error('Glide API error:', errorDetails);
    
    let errorMessage = 'Glide API error';
    if (glideResponse.status === 401) {
      errorMessage = 'Invalid or expired Glide API token. Please check your Edge Function secrets.';
    } else if (glideResponse.status === 403) {
      errorMessage = 'Access forbidden. Please verify your Glide API permissions.';
    } else if (glideResponse.status === 404) {
      errorMessage = 'Glide table not found. Please verify your table ID.';
    }
    
    throw new Error(`${errorMessage}: ${JSON.stringify(errorDetails, null, 2)}`);
  }

  const responseData = await glideResponse.json();
  console.log('Successfully fetched records from Glide:', {
    record_count: responseData.length,
    table_id: tableId
  });

  return responseData;
}

export async function createGlideRecord(tableId: string, recordData: any): Promise<void> {
  const apiToken = Deno.env.get('GLIDE_API_TOKEN')?.trim();
  if (!apiToken) {
    throw new Error('GLIDE_API_TOKEN is not set in Edge Function secrets');
  }

  console.log('Creating record in Glide:', {
    table_id: tableId,
    data_preview: JSON.stringify(recordData).substring(0, 100) + '...'
  });

  const createResponse = await fetch(
    `https://api.glideapp.io/api/tables/${encodeURIComponent(tableId)}/rows`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify([recordData])
    }
  );

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    throw new Error(`Failed to create Glide record: ${errorText}`);
  }

  console.log('Successfully created record in Glide');
}

export async function updateGlideRecord(tableId: string, recordId: string, recordData: any): Promise<void> {
  const apiToken = Deno.env.get('GLIDE_API_TOKEN')?.trim();
  if (!apiToken) {
    throw new Error('GLIDE_API_TOKEN is not set in Edge Function secrets');
  }

  console.log('Updating record in Glide:', {
    table_id: tableId,
    record_id: recordId,
    data_preview: JSON.stringify(recordData).substring(0, 100) + '...'
  });

  const updateResponse = await fetch(
    `https://api.glideapp.io/api/tables/${encodeURIComponent(tableId)}/rows/${encodeURIComponent(recordId)}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(recordData)
    }
  );

  if (!updateResponse.ok) {
    const errorText = await updateResponse.text();
    throw new Error(`Failed to update Glide record: ${errorText}`);
  }

  console.log('Successfully updated record in Glide');
}