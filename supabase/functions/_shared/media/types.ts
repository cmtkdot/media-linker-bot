export interface MediaProcessingResult {
  publicUrl: string;
  storagePath: string;
  isExisting: boolean;
  error?: string;
}

export interface MediaProcessingLog {
  messageId: string;
  fileId: string;
  fileType: string;
  status: 'processed' | 'error' | 'duplicate';
  storagePath?: string;
  errorMessage?: string;
  correlationId?: string;
}

export interface MediaStorageOptions {
  botToken?: string;
  fileId?: string;
  retryCount?: number;
}