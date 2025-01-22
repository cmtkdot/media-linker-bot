import { Json } from "@/integrations/supabase/types";

export type MediaFileType = 'video' | 'photo' | 'document';
export type MediaItemValue = string | number | Date | null;

export interface TelegramChat {
  id?: number;
  type?: string;
  title?: string;
  username?: string;
}

export interface TelegramData {
  chat?: TelegramChat;
  message_id?: number;
  chat_id?: number;
  storage_path?: string;
  media_group_id?: string;
  date?: number;
}

export interface AnalyzedContent {
  text?: string;
  labels?: string[];
  objects?: string[];
}

export interface MediaItem {
  id: string;
  public_url: string | null;
  default_public_url: string | null;
  thumbnail_url?: string | null;
  file_type: MediaFileType;
  file_id: string;
  file_unique_id: string;
  caption?: string | null;
  product_code?: string | null;
  product_name?: string | null;
  quantity?: number | null;
  vendor_uid?: string | null;
  purchase_date?: string | null;
  notes?: string | null;
  message_url?: string | null;
  chat_url?: string | null;
  telegram_data: Record<string, any>;
  analyzed_content?: AnalyzedContent;
  created_at: string;
  updated_at?: string;
  glide_data: Record<string, any>;
  media_metadata: Record<string, any>;
}

export interface SupabaseMediaItem {
  id: string;
  public_url: string | null;
  default_public_url: string | null;
  thumbnail_url?: string | null;
  file_type: string;
  file_id: string;
  file_unique_id: string;
  caption?: string | null;
  product_code?: string | null;
  product_name?: string | null;
  quantity?: number | null;
  vendor_uid?: string | null;
  purchase_date?: string | null;
  notes?: string | null;
  message_url?: string | null;
  chat_url?: string | null;
  telegram_data: Json;
  analyzed_content: Json | null;
  created_at: string;
  updated_at?: string;
  glide_data: Json;
  media_metadata: Json;
}

export interface MediaSearchBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  view: 'grid' | 'table';
  onViewChange: (view: 'grid' | 'table') => void;
  selectedChannel: string;
  onChannelChange: (value: string) => void;
  selectedType: string;
  onTypeChange: (value: string) => void;
  selectedVendor: string;
  onVendorChange: (value: string) => void;
  channels: string[];
  vendors: string[];
}

export interface MediaEditDialogProps {
  editItem: MediaItem | null;
  onClose: () => void;
  onSave: () => Promise<void>;
  onItemChange: (field: keyof MediaItem, value: MediaItemValue) => void;
  formatDate: (date: string | null) => string | null;
}

export interface MediaViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  media: MediaItem | null;
}

export interface MediaTableProps {
  data: MediaItem[];
  onEdit: (item: MediaItem) => void;
}