export enum SyncErrorType {
  NETWORK = 'NETWORK',
  VALIDATION = 'VALIDATION',
  API = 'API',
  DATABASE = 'DATABASE',
  UNKNOWN = 'UNKNOWN'
}

export interface SyncLogEntry {
  timestamp: string;
  operation: string;
  status: 'success' | 'error';
  errorType?: SyncErrorType;
  details: Record<string, any>;
  correlationId: string;
}

export function createSyncLogger(correlationId: string) {
  return {
    log: (entry: Omit<SyncLogEntry, 'timestamp' | 'correlationId'>) => {
      console.log(JSON.stringify({
        ...entry,
        timestamp: new Date().toISOString(),
        correlationId
      }));
    }
  };
}