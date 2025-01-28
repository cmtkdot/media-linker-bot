export interface MediaFile {
  file_id: string;
  file_unique_id: string;
  file_type: string;
  mime_type?: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
}

export interface MediaProcessingResult {
  publicUrl: string;
  storagePath: string;
  isExisting: boolean;
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