import { Database as GeneratedDatabase } from "@/integrations/supabase/types";
import { SyncResult, TableResult } from "./media";

export interface Database extends Omit<GeneratedDatabase, 'public'> {
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
        Returns: GeneratedDatabase['public']['Tables']['telegram_media']['Row'][];
      };
    };
    Enums: GeneratedDatabase['public']['Enums'];
    CompositeTypes: GeneratedDatabase['public']['CompositeTypes'];
  };
}