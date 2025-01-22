import type { GlideMutation, GlideApiRequest } from '../_shared/types.ts';

export class GlideAPI {
  constructor(
    private appId: string,
    private tableId: string,
    private apiToken: string
  ) {}

  private async makeRequest(method: string, mutation: GlideMutation) {
    console.log('Making Glide API request:', { method, mutation });
    
    const request: GlideApiRequest = {
      appID: this.appId,
      mutations: [mutation]
    };

    const response = await fetch('https://api.glideapp.io/api/function/mutateTables', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Glide API error:', { status: response.status, error: errorText });
      throw new Error(`Glide API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('Glide API response:', data);
    return data;
  }

  async addRow(data: Record<string, unknown>) {
    return this.makeRequest('POST', {
      kind: 'set-columns-in-row',
      tableName: this.tableId,
      columnValues: data,
      rowID: data.id as string
    });
  }

  async updateRow(rowId: string, data: Record<string, unknown>) {
    return this.makeRequest('POST', {
      kind: 'set-columns-in-row',
      tableName: this.tableId,
      rowID: rowId,
      columnValues: data
    });
  }

  async deleteRow(rowId: string) {
    return this.makeRequest('POST', {
      kind: 'delete-row',
      tableName: this.tableId,
      rowID: rowId
    });
  }
}