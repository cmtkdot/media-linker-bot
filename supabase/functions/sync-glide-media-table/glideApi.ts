import type { GlideMutation, GlideApiRequest, GlideApiResponse } from './types.ts';
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
  constructor(
    private appId: string,
    private tableId: string,
    private apiToken: string,
    private supabase: ReturnType<typeof createClient>
  ) {}

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

  private extractRowId(response: any): string {
    console.log('Extracting rowID from response:', response);
    
    // Handle array response
    if (Array.isArray(response)) {
      if (response.length === 0) {
        throw new GlideApiError('Empty response array from Glide API');
      }
      const firstItem = response[0];
      if (typeof firstItem === 'object' && firstItem !== null) {
        const rowId = firstItem.rowID || firstItem.Row_ID || firstItem.Row_Id || firstItem.row_id;
        if (rowId) return rowId;
      }
    }
    
    // Handle single object response
    if (typeof response === 'object' && response !== null) {
      const rowId = response.rowID || response.Row_ID || response.Row_Id || response.row_id;
      if (rowId) return rowId;
    }

    throw new GlideApiError(
      'Could not find rowID in response',
      undefined,
      JSON.stringify(response)
    );
  }

  async addRow(data: GlideMutation['columnValues'], recordId: string) {
    const response = await this.makeRequest('POST', {
      kind: 'add-row-to-table',
      tableName: this.tableId,
      columnValues: data
    });

    const rowId = this.extractRowId(response);

    try {
      const { error } = await this.supabase
        .from('telegram_media')
        .update({ telegram_media_row_id: rowId })
        .eq('id', recordId);

      if (error) {
        throw error;
      }
    } catch (error) {
      throw new GlideApiError(
        `Error updating telegram_media_row_id: ${error.message}`
      );
    }

    return response;
  }

  async updateRow(rowId: string, data: GlideMutation['columnValues']) {
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