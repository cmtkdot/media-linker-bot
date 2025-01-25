import { Database as GeneratedDatabase } from "@/integrations/supabase/types";
import { MediaItem, SyncResult, TableResult } from "./media";

// Extend the generated Database type with our custom RPC functions
export interface Database extends GeneratedDatabase {
  public: {
    Tables: GeneratedDatabase['public']['Tables'];
    Views: GeneratedDatabase['public']['Views'];
    Functions: {
      get_all_tables: {
        Args: Record<string, never>;
        Returns: TableResult[];
      };
      create_glide_sync_table: {
        Args: { table_name: string };
        Returns: undefined;
      };
      sync_messages_to_telegram_media: {
        Args: Record<string, never>;
        Returns: SyncResult[];
      };
      search_telegram_media: {
        Args: { search_term: string };
        Returns: MediaItem[];
      };
    };
    Enums: GeneratedDatabase['public']['Enums'];
    CompositeTypes: GeneratedDatabase['public']['CompositeTypes'];
  };
}