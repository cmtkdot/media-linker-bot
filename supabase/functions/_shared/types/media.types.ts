export interface MediaFile {
  file_id: string;
  file_unique_id: string;
  file_type: string;
  mime_type?: string;
  public_url?: string;
  storage_path?: string;
}

export interface MediaProcessingResult {
  success: boolean;
  publicUrl?: string;
  storagePath?: string;
  error?: string;
}