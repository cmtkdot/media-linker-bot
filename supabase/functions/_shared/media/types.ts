export interface MediaProcessingResult {
  publicUrl: string;
  storagePath: string;
  isExisting: boolean;
  error?: string;
}

export interface MediaProcessingOptions {
  botToken?: string;
  fileId?: string;
  retryCount?: number;
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