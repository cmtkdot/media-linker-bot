import type { GlideMutation, GlideApiRequest } from '../_shared/types.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

class GlideApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public response?: string
  ) {
    super(message);
    this.name = 'GlideApiError';
  }
}

export class GlideAPI {
  private supabase;

  constructor(
    private appId: string,
    private tableId: string,
    private apiToken: string
  ) {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  private async makeRequest(method: string, mutation: GlideMutation) {
    console.log('Making Glide API request:', { method, mutation });
    
    const request: GlideApiRequest = {
      appID: this.appId,
      mutations: [mutation]
    };

    let response;
    try {
      response = await fetch('https://api.glideapp.io/api/function/mutateTables', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request)
      });
    } catch (error) {
      throw new GlideApiError(
        `Network error while calling Glide API: ${error.message}`
      );
    }

    let responseText;
    try {
      responseText = await response.text();
    } catch (error) {
      throw new GlideApiError(
        `Error reading Glide API response: ${error.message}`,
        response.status
      );
    }

    if (!response.ok) {
      console.error('Glide API error:', { 
        status: response.status, 
        error: responseText,
        request: {
          method,
          mutation: { ...mutation, apiToken: '***' }
        }
      });
      
      throw new GlideApiError(
        `Glide API error: ${response.status} ${responseText}`,
        response.status,
        responseText
      );
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (error) {
      throw new GlideApiError(
        `Invalid JSON in Glide API response: ${error.message}`,
        response.status,
        responseText
      );
    }

    console.log('Glide API response:', data);
    return data;
  }

  async addRow(data: Record<string, any>, recordId: string) {
    const response = await this.makeRequest('POST', {
      kind: 'add-row-to-table',
      tableName: this.tableId,
      columnValues: data
    });

    // Handle array response format
    let rowID: string | undefined;
    if (Array.isArray(response) && response.length > 0) {
      rowID = response[0].rowID;
    } else if (response && typeof response === 'object') {
      rowID = response.rowID;
    }

    // Validate rowID
    if (!rowID) {
      console.error('Invalid response format:', response);
      throw new GlideApiError(
        'Glide API did not return a valid rowID',
        undefined,
        JSON.stringify(response)
      );
    }

    // Update telegram_media_row_id in Supabase
    try {
      const { error } = await this.supabase
        .from('telegram_media')
        .update({ telegram_media_row_id: rowID })
        .eq('id', recordId);

      if (error) {
        throw error;
      }
    } catch (error) {
      throw new GlideApiError(
        `Error updating telegram_media_row_id: ${error.message}`
      );
    }

    return { rowID };
  }

  async updateRow(rowId: string, data: Record<string, any>) {
    if (!rowId) {
      throw new GlideApiError('rowId is required for update operation');
    }

    return this.makeRequest('POST', {
      kind: 'set-columns-in-row',
      tableName: this.tableId,
      rowID: rowId,
      columnValues: data
    });
  }

  async deleteRow(rowId: string) {
    if (!rowId) {
      throw new GlideApiError('rowId is required for delete operation');
    }

    return this.makeRequest('POST', {
      kind: 'delete-row',
      tableName: this.tableId,
      rowID: rowId
    });
  }
}