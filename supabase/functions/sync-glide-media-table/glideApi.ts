import { GlideTableSchema } from './types.ts';

const GLIDE_API_BASE = 'https://api.glideapp.io/api/function/mutateTables';

function validateGlideToken(token: string | undefined): string {
  if (!token) {
    throw new Error('Glide API token is not set');
  }

  const trimmedToken = token.trim();
  if (trimmedToken.length < 36) {
    throw new Error('Invalid Glide API token format');
  }

  return trimmedToken;
}

async function handleGlideResponse(response: Response, operation: string) {
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Glide API error:', {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
      config: {
        table_id: 'native-table-crVqfFJXQde5cGcYmqWs',
        has_token: !!Deno.env.get('GLIDE_API_TOKEN'),
        token_length: Deno.env.get('GLIDE_API_TOKEN')?.length,
        auth_header_preview: `Bearer ${Deno.env.get('GLIDE_API_TOKEN')?.substring(0, 5)}...${Deno.env.get('GLIDE_API_TOKEN')?.slice(-5)}`
      }
    });

    let errorMessage = `Glide API ${operation} failed: ${response.status} ${response.statusText}`;
    if (response.status === 401) {
      errorMessage = 'Invalid or expired Glide API token';
    } else if (response.status === 403) {
      errorMessage = 'Access denied to Glide API';
    } else if (response.status === 404) {
      errorMessage = 'Glide table or record not found';
    }

    throw new Error(errorMessage);
  }

  return await response.json();
}

export async function fetchGlideRecords(tableId: string) {
  const token = validateGlideToken(Deno.env.get('GLIDE_API_TOKEN'));

  const response = await fetch(`${GLIDE_API_BASE}/${tableId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return handleGlideResponse(response, 'fetch');
}

export async function createGlideRecord(tableId: string, data: Record<string, any>) {
  const token = validateGlideToken(Deno.env.get('GLIDE_API_TOKEN'));
  const schema = GlideTableSchema;

  // Map the data to Glide column names
  const mappedData: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const schemaKey = key as keyof typeof schema;
    if (schema[schemaKey]) {
      mappedData[schema[schemaKey].name] = value;
    }
  }

  const response = await fetch(`${GLIDE_API_BASE}/${tableId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      records: [mappedData]
    }),
  });

  return handleGlideResponse(response, 'create');
}

export async function updateGlideRecord(tableId: string, recordId: string, data: Record<string, any>) {
  const token = validateGlideToken(Deno.env.get('GLIDE_API_TOKEN'));
  const schema = GlideTableSchema;

  // Map the data to Glide column names
  const mappedData: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const schemaKey = key as keyof typeof schema;
    if (schema[schemaKey]) {
      mappedData[schema[schemaKey].name] = value;
    }
  }

  const response = await fetch(`${GLIDE_API_BASE}/${tableId}/${recordId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(mappedData),
  });

  return handleGlideResponse(response, 'update');
}