export class GlideAPI {
  constructor(
    private appId: string,
    private tableId: string,
    private apiToken: string
  ) {}

  private async makeRequest(method: string, body: any) {
    const response = await fetch('https://api.glideapp.io/api/function/mutateTables', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        appID: this.appId,
        mutations: [body]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Glide API error: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  async addRow(data: Record<string, any>) {
    return this.makeRequest('POST', {
      kind: 'add-row-to-table',
      tableName: this.tableId,
      columnValues: data
    });
  }

  async updateRow(rowId: string, data: Record<string, any>) {
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