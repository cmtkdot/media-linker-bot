export interface TelegramMediaFile {
  file_id: string;
  file_unique_id: string;
  file_type: string;
  width?: number;
  height?: number;
  duration?: number;
  file_size?: number;
}

export interface StorageResult {
  publicUrl: string;
  storagePath: string;
  isExisting: boolean;
}

export interface MediaProcessingOptions {
  botToken?: string;
  fileId?: string;
  retryCount?: number;
}