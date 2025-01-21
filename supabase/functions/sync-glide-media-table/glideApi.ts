import { corsHeaders } from './cors.ts';
import { GlideRecord, GlideTableSchema } from './types.ts';

const GLIDE_COLUMN_MAPPING: GlideTableSchema = {
  id: { type: "string", name: "UkkMS" },
  fileId: { type: "string", name: "9Bod8" },
  fileUniqueId: { type: "string", name: "IYnip" },
  fileType: { type: "string", name: "hbjE4" },
  publicUrl: { type: "uri", name: "d8Di5" },
  productName: { type: "string", name: "xGGv3" },
  productCode: { type: "string", name: "xlfB9" },
  quantity: { type: "number", name: "TWRwx" },
  telegramData: { type: "string", name: "Wm1he" },
  glideData: { type: "string", name: "ZRV7Z" },
  mediaMetadata: { type: "string", name: "Eu9Zn" },
  processed: { type: "boolean", name: "oj7fP" },
  processingError: { type: "string", name: "A4sZX" },
  lastSyncedAt: { type: "string", name: "PWhCr" },
  createdAt: { type: "string", name: "Oa3L9" },
  updatedAt: { type: "string", name: "9xwrl" },
  messageId: { type: "string", name: "Uzkgt" },
  caption: { type: "string", name: "pRsjz" },
  vendorUid: { type: "string", name: "uxDo1" },
  purchaseDate: { type: "date", name: "AMWxJ" },
  notes: { type: "string", name: "BkUFO" },
  analyzedContent: { type: "string", name: "QhAgy" },
  purchaseOrderUid: { type: "string", name: "3y8Wt" },
  defaultPublicUrl: { type: "uri", name: "rCJK2" }
};

function validateGlideToken(token: string | undefined): string {
  if (!token) {
    throw new Error('GLIDE_API_TOKEN is not set in Edge Function secrets');
  }
  
  const cleanToken = token.trim();
  if (!cleanToken) {
    throw new Error('GLIDE_API_TOKEN cannot be empty');
  }

  if (cleanToken.length < 20) {
    throw new Error('GLIDE_API_TOKEN appears to be invalid (too short)');
  }

  return cleanToken;
}

function mapToGlideColumns(data: Record<string, any>): Record<string, any> {
  const mapped: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const glideColumn = GLIDE_COLUMN_MAPPING[key as keyof GlideTableSchema];
    if (glideColumn) {
      mapped[glideColumn.name] = value;
    }
  }
  return mapped;
}

function mapFromGlideColumns(data: Record<string, any>): Record<string, any> {
  const mapped: Record<string, any> = {};
  for (const [key, column] of Object.entries(GLIDE_COLUMN_MAPPING)) {
    if (data[column.name] !== undefined) {
      mapped[key] = data[column.name];
    }
  }
  return mapped;
}

export async function fetchGlideRecords(tableId: string): Promise<GlideRecord[]> {
  const apiToken = validateGlideToken(Deno.env.get('GLIDE_API_TOKEN'));

  console.log('Making request to Glide API:', {
    table_id: tableId,
    token_length: apiToken.length,
    token_preview: `${apiToken.substring(0, 5)}...${apiToken.substring(apiToken.length - 5)}`,
  });

  const glideResponse = await fetch(
    `https://api.glideapp.io/api/tables/${tableId}/rows`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json; charset=utf-8',
        ...corsHeaders
      }
    }
  );

  const errorDetails = {
    status: glideResponse.status,
    statusText: glideResponse.statusText,
    error: await glideResponse.text(),
    config: {
      table_id: tableId,
      has_token: !!apiToken,
      token_length: apiToken.length,
      auth_header_preview: `Bearer ${apiToken.substring(0, 5)}...${apiToken.substring(apiToken.length - 5)}`
    }
  };

  if (!glideResponse.ok) {
    let errorMessage = 'Glide API error';
    if (glideResponse.status === 401) {
      errorMessage = 'Invalid or expired Glide API token. Please check your Edge Function secrets and ensure the token is valid.';
    } else if (glideResponse.status === 403) {
      errorMessage = 'Access forbidden. Please verify your Glide API permissions and token scope.';
    } else if (glideResponse.status === 404) {
      errorMessage = 'Glide table not found. Please verify your table ID and API access.';
    }
    
    throw new Error(`${errorMessage}: ${JSON.stringify(errorDetails, null, 2)}`);
  }

  try {
    const data = await glideResponse.json();
    return data.map(mapFromGlideColumns);
  } catch (error) {
    console.error('Error parsing Glide API response:', error);
    throw new Error(`Failed to parse Glide API response: ${error.message}`);
  }
}

export async function createGlideRecord(tableId: string, recordData: any): Promise<void> {
  const apiToken = validateGlideToken(Deno.env.get('GLIDE_API_TOKEN'));
  const mappedData = mapToGlideColumns(recordData);

  console.log('Creating record in Glide:', {
    table_id: tableId,
    data_preview: JSON.stringify(mappedData).substring(0, 100) + '...'
  });

  const createResponse = await fetch(
    `https://api.glideapp.io/api/tables/${tableId}/rows`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json; charset=utf-8',
        ...corsHeaders
      },
      body: JSON.stringify([mappedData])
    }
  );

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    console.error('Error creating Glide record:', {
      status: createResponse.status,
      statusText: createResponse.statusText,
      error: errorText
    });
    throw new Error(`Failed to create Glide record: ${errorText}`);
  }
}

export async function updateGlideRecord(tableId: string, recordId: string, recordData: any): Promise<void> {
  const apiToken = validateGlideToken(Deno.env.get('GLIDE_API_TOKEN'));
  const mappedData = mapToGlideColumns(recordData);

  console.log('Updating record in Glide:', {
    table_id: tableId,
    record_id: recordId,
    data_preview: JSON.stringify(mappedData).substring(0, 100) + '...'
  });

  const updateResponse = await fetch(
    `https://api.glideapp.io/api/tables/${tableId}/rows/${recordId}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json; charset=utf-8',
        ...corsHeaders
      },
      body: JSON.stringify(mappedData)
    }
  );

  if (!updateResponse.ok) {
    const errorText = await updateResponse.text();
    console.error('Error updating Glide record:', {
      status: updateResponse.status,
      statusText: updateResponse.statusText,
      error: errorText
    });
    throw new Error(`Failed to update Glide record: ${errorText}`);
  }
}