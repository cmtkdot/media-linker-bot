import { Database as GeneratedDatabase } from "@/integrations/supabase/types";

export interface Database extends Omit<GeneratedDatabase, 'public'> {
  public: {
    Tables: GeneratedDatabase['public']['Tables'];
    Views: GeneratedDatabase['public']['Views'];
    Functions: {
      sync_messages_to_telegram_media: {
        Args: Record<string, never>;
        Returns: { synced_count: number; error_count: number; }[];
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