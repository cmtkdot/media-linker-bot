export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      glide_config: {
        Row: {
          active: boolean | null
          api_token: string
          app_id: string
          created_at: string
          id: string
          supabase_table_name: string | null
          table_id: string
          table_name: string
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          api_token: string
          app_id: string
          created_at?: string
          id?: string
          supabase_table_name?: string | null
          table_id: string
          table_name: string
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          api_token?: string
          app_id?: string
          created_at?: string
          id?: string
          supabase_table_name?: string | null
          table_id?: string
          table_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      glide_products: {
        Row: {
          account_row_id: string | null
          cart_note: string | null
          cart_rename: boolean | null
          category: string | null
          cost: number | null
          cost_update: number | null
          created_at: string | null
          fronted_terms: string | null
          glide_product_row_id: string
          is_fronted: boolean | null
          is_miscellaneous: boolean | null
          is_sample: boolean | null
          last_edited_date: string | null
          last_synced: string | null
          leave_no: string | null
          more_units_behind: boolean | null
          po_date: string | null
          po_uid: string | null
          product_choice_row_id: string | null
          product_data: Json
          product_image_1: string | null
          product_name: string | null
          purchase_date: string | null
          purchase_notes: string | null
          purchase_order_row_id: string | null
          rename_product: boolean | null
          sheet21pics_row_id: string | null
          submission_date: string | null
          submitter_email: string | null
          supabase_caption: string | null
          supabase_google_url: string | null
          supabase_media_id: string | null
          supabase_video_link: string | null
          table_config_id: string | null
          total_qty_purchased: number | null
          total_units_behind_sample: number | null
          updated_at: string | null
          uuid: string
          uuif: string | null
          vendor_product_name: string | null
          vendor_uid: string | null
          vpay_row_id: string | null
        }
        Insert: {
          account_row_id?: string | null
          cart_note?: string | null
          cart_rename?: boolean | null
          category?: string | null
          cost?: number | null
          cost_update?: number | null
          created_at?: string | null
          fronted_terms?: string | null
          glide_product_row_id: string
          is_fronted?: boolean | null
          is_miscellaneous?: boolean | null
          is_sample?: boolean | null
          last_edited_date?: string | null
          last_synced?: string | null
          leave_no?: string | null
          more_units_behind?: boolean | null
          po_date?: string | null
          po_uid?: string | null
          product_choice_row_id?: string | null
          product_data?: Json
          product_image_1?: string | null
          product_name?: string | null
          purchase_date?: string | null
          purchase_notes?: string | null
          purchase_order_row_id?: string | null
          rename_product?: boolean | null
          sheet21pics_row_id?: string | null
          submission_date?: string | null
          submitter_email?: string | null
          supabase_caption?: string | null
          supabase_google_url?: string | null
          supabase_media_id?: string | null
          supabase_video_link?: string | null
          table_config_id?: string | null
          total_qty_purchased?: number | null
          total_units_behind_sample?: number | null
          updated_at?: string | null
          uuid?: string
          uuif?: string | null
          vendor_product_name?: string | null
          vendor_uid?: string | null
          vpay_row_id?: string | null
        }
        Update: {
          account_row_id?: string | null
          cart_note?: string | null
          cart_rename?: boolean | null
          category?: string | null
          cost?: number | null
          cost_update?: number | null
          created_at?: string | null
          fronted_terms?: string | null
          glide_product_row_id?: string
          is_fronted?: boolean | null
          is_miscellaneous?: boolean | null
          is_sample?: boolean | null
          last_edited_date?: string | null
          last_synced?: string | null
          leave_no?: string | null
          more_units_behind?: boolean | null
          po_date?: string | null
          po_uid?: string | null
          product_choice_row_id?: string | null
          product_data?: Json
          product_image_1?: string | null
          product_name?: string | null
          purchase_date?: string | null
          purchase_notes?: string | null
          purchase_order_row_id?: string | null
          rename_product?: boolean | null
          sheet21pics_row_id?: string | null
          submission_date?: string | null
          submitter_email?: string | null
          supabase_caption?: string | null
          supabase_google_url?: string | null
          supabase_media_id?: string | null
          supabase_video_link?: string | null
          table_config_id?: string | null
          total_qty_purchased?: number | null
          total_units_behind_sample?: number | null
          updated_at?: string | null
          uuid?: string
          uuif?: string | null
          vendor_product_name?: string | null
          vendor_uid?: string | null
          vpay_row_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "glide_products_table_config_id_fkey"
            columns: ["table_config_id"]
            isOneToOne: false
            referencedRelation: "glide_config"
            referencedColumns: ["id"]
          },
        ]
      }
      glide_sync_queue: {
        Row: {
          batch_id: string | null
          correlation_id: string | null
          created_at: string | null
          error: string | null
          id: string
          max_retries: number | null
          new_data: Json | null
          old_data: Json | null
          operation: string
          priority: number | null
          processed_at: string | null
          record_id: string
          retry_count: number | null
          sync_type: string | null
          table_name: string
        }
        Insert: {
          batch_id?: string | null
          correlation_id?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          max_retries?: number | null
          new_data?: Json | null
          old_data?: Json | null
          operation: string
          priority?: number | null
          processed_at?: string | null
          record_id: string
          retry_count?: number | null
          sync_type?: string | null
          table_name: string
        }
        Update: {
          batch_id?: string | null
          correlation_id?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          max_retries?: number | null
          new_data?: Json | null
          old_data?: Json | null
          operation?: string
          priority?: number | null
          processed_at?: string | null
          record_id?: string
          retry_count?: number | null
          sync_type?: string | null
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "glide_sync_queue_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "telegram_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "glide_sync_queue_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "telegram_media_messages"
            referencedColumns: ["telegram_media_id"]
          },
        ]
      }
      media_processing_logs: {
        Row: {
          correlation_id: string | null
          created_at: string | null
          error_message: string | null
          file_id: string | null
          file_type: string | null
          id: string
          last_retry_at: string | null
          message_id: string | null
          processed_at: string | null
          retry_count: number | null
          status: string | null
          storage_path: string | null
        }
        Insert: {
          correlation_id?: string | null
          created_at?: string | null
          error_message?: string | null
          file_id?: string | null
          file_type?: string | null
          id?: string
          last_retry_at?: string | null
          message_id?: string | null
          processed_at?: string | null
          retry_count?: number | null
          status?: string | null
          storage_path?: string | null
        }
        Update: {
          correlation_id?: string | null
          created_at?: string | null
          error_message?: string | null
          file_id?: string | null
          file_type?: string | null
          id?: string
          last_retry_at?: string | null
          message_id?: string | null
          processed_at?: string | null
          retry_count?: number | null
          status?: string | null
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_processing_logs_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_processing_logs_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "telegram_media_messages"
            referencedColumns: ["message_id"]
          },
        ]
      }
      messages: {
        Row: {
          analyzed_content: Json | null
          caption: string | null
          chat_id: number
          correlation_id: string | null
          created_at: string
          error_count: number | null
          id: string
          is_original_caption: boolean | null
          last_error: string | null
          last_group_message_at: string | null
          last_retry_at: string | null
          last_status_change: string | null
          max_retries: number | null
          media_group_id: string | null
          media_group_size: number | null
          message_id: number
          message_media_data: Json | null
          message_type: string
          message_url: string | null
          notes: string | null
          original_message_id: string | null
          processed_at: string | null
          processing_error: string | null
          product_code: string | null
          product_name: string | null
          purchase_date: string | null
          quantity: number | null
          retry_count: number | null
          sender_info: Json
          status: string | null
          status_history: Json | null
          telegram_data: Json
          text: string | null
          updated_at: string
          vendor_uid: string | null
        }
        Insert: {
          analyzed_content?: Json | null
          caption?: string | null
          chat_id: number
          correlation_id?: string | null
          created_at?: string
          error_count?: number | null
          id?: string
          is_original_caption?: boolean | null
          last_error?: string | null
          last_group_message_at?: string | null
          last_retry_at?: string | null
          last_status_change?: string | null
          max_retries?: number | null
          media_group_id?: string | null
          media_group_size?: number | null
          message_id: number
          message_media_data?: Json | null
          message_type: string
          message_url?: string | null
          notes?: string | null
          original_message_id?: string | null
          processed_at?: string | null
          processing_error?: string | null
          product_code?: string | null
          product_name?: string | null
          purchase_date?: string | null
          quantity?: number | null
          retry_count?: number | null
          sender_info?: Json
          status?: string | null
          status_history?: Json | null
          telegram_data?: Json
          text?: string | null
          updated_at?: string
          vendor_uid?: string | null
        }
        Update: {
          analyzed_content?: Json | null
          caption?: string | null
          chat_id?: number
          correlation_id?: string | null
          created_at?: string
          error_count?: number | null
          id?: string
          is_original_caption?: boolean | null
          last_error?: string | null
          last_group_message_at?: string | null
          last_retry_at?: string | null
          last_status_change?: string | null
          max_retries?: number | null
          media_group_id?: string | null
          media_group_size?: number | null
          message_id?: number
          message_media_data?: Json | null
          message_type?: string
          message_url?: string | null
          notes?: string | null
          original_message_id?: string | null
          processed_at?: string | null
          processing_error?: string | null
          product_code?: string | null
          product_name?: string | null
          purchase_date?: string | null
          quantity?: number | null
          retry_count?: number | null
          sender_info?: Json
          status?: string | null
          status_history?: Json | null
          telegram_data?: Json
          text?: string | null
          updated_at?: string
          vendor_uid?: string | null
        }
        Relationships: []
      }
      telegram_media: {
        Row: {
          analyzed_content: Json | null
          caption: string | null
          correlation_id: string | null
          created_at: string
          duration: number | null
          file_id: string | null
          file_size: number | null
          file_type: string | null
          file_unique_id: string | null
          glide_app_url: string | null
          glide_data: Json | null
          height: number | null
          id: string
          is_original_caption: boolean | null
          last_retry_at: string | null
          last_synced_at: string | null
          max_retries: number | null
          media_group_id: string | null
          media_group_size: number | null
          media_metadata: Json | null
          message_id: string
          message_media_data: Json | null
          mime_type: string | null
          notes: string | null
          original_message_id: string | null
          processed: boolean | null
          processed_at: string | null
          processing_error: string | null
          product_code: string | null
          product_name: string | null
          public_url: string | null
          purchase_date: string | null
          purchase_order_uid: string | null
          quantity: number | null
          retry_count: number | null
          status: string | null
          storage_path: string | null
          telegram_media_row_id: string | null
          updated_at: string
          vendor_uid: string | null
          width: number | null
        }
        Insert: {
          analyzed_content?: Json | null
          caption?: string | null
          correlation_id?: string | null
          created_at?: string
          duration?: number | null
          file_id?: string | null
          file_size?: number | null
          file_type?: string | null
          file_unique_id?: string | null
          glide_app_url?: string | null
          glide_data?: Json | null
          height?: number | null
          id?: string
          is_original_caption?: boolean | null
          last_retry_at?: string | null
          last_synced_at?: string | null
          max_retries?: number | null
          media_group_id?: string | null
          media_group_size?: number | null
          media_metadata?: Json | null
          message_id: string
          message_media_data?: Json | null
          mime_type?: string | null
          notes?: string | null
          original_message_id?: string | null
          processed?: boolean | null
          processed_at?: string | null
          processing_error?: string | null
          product_code?: string | null
          product_name?: string | null
          public_url?: string | null
          purchase_date?: string | null
          purchase_order_uid?: string | null
          quantity?: number | null
          retry_count?: number | null
          status?: string | null
          storage_path?: string | null
          telegram_media_row_id?: string | null
          updated_at?: string
          vendor_uid?: string | null
          width?: number | null
        }
        Update: {
          analyzed_content?: Json | null
          caption?: string | null
          correlation_id?: string | null
          created_at?: string
          duration?: number | null
          file_id?: string | null
          file_size?: number | null
          file_type?: string | null
          file_unique_id?: string | null
          glide_app_url?: string | null
          glide_data?: Json | null
          height?: number | null
          id?: string
          is_original_caption?: boolean | null
          last_retry_at?: string | null
          last_synced_at?: string | null
          max_retries?: number | null
          media_group_id?: string | null
          media_group_size?: number | null
          media_metadata?: Json | null
          message_id?: string
          message_media_data?: Json | null
          mime_type?: string | null
          notes?: string | null
          original_message_id?: string | null
          processed?: boolean | null
          processed_at?: string | null
          processing_error?: string | null
          product_code?: string | null
          product_name?: string | null
          public_url?: string | null
          purchase_date?: string | null
          purchase_order_uid?: string | null
          quantity?: number | null
          retry_count?: number | null
          status?: string | null
          storage_path?: string | null
          telegram_media_row_id?: string | null
          updated_at?: string
          vendor_uid?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_media_correlation_id_fkey"
            columns: ["correlation_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["correlation_id"]
          },
          {
            foreignKeyName: "telegram_media_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telegram_media_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "telegram_media_messages"
            referencedColumns: ["message_id"]
          },
        ]
      }
    }
    Views: {
      telegram_media_messages: {
        Row: {
          analyzed_content: Json | null
          caption: string | null
          file_id: string | null
          file_type: string | null
          file_unique_id: string | null
          is_original_caption: boolean | null
          media_group_id: string | null
          message_id: string | null
          message_media_data: Json | null
          notes: string | null
          original_message_id: string | null
          po_uid: string | null
          product_code: string | null
          product_name: string | null
          public_url: string | null
          purchase_date: string | null
          quantity: number | null
          storage_path: string | null
          telegram_media_id: string | null
          vendor_uid: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_media_sync_status: {
        Args: Record<PropertyKey, never>
        Returns: {
          total_messages: number
          messages_with_media: number
          total_telegram_media: number
          unsynced_records: number
        }[]
      }
      check_storage_metrics: {
        Args: Record<PropertyKey, never>
        Returns: {
          total_files: number
          total_size: number
          avg_file_size: number
          files_last_24h: number
        }[]
      }
      create_glide_sync_table: {
        Args: {
          p_table_name: string
        }
        Returns: undefined
      }
      get_all_tables: {
        Args: Record<PropertyKey, never>
        Returns: {
          table_name: string
        }[]
      }
      get_original_caption_holder: {
        Args: {
          media_group_id: string
        }
        Returns: string
      }
      get_public_url: {
        Args: {
          storage_path: string
        }
        Returns: string
      }
      get_unique_media_group: {
        Args: {
          p_group_id: string
        }
        Returns: {
          message_id: string
          message_url: string
          public_url: string
          caption: string
          analyzed_content: Json
          is_original_caption: boolean
          message_date: string
        }[]
      }
      insert_webhook_message: {
        Args: {
          p_message_id: number
          p_chat_id: number
          p_sender_info: Json
          p_message_type: string
          p_telegram_data: Json
          p_media_group_id: string
          p_caption: string
          p_message_url: string
          p_analyzed_content: Json
          p_is_original_caption: boolean
          p_original_message_id: string
          p_message_media_data: Json
          p_correlation_id: string
          p_status: string
          p_processed_at: string
        }
        Returns: {
          id: string
          message_id: number
          status: string
        }[]
      }
      maintenance_cleanup_consolidated: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      search_telegram_media: {
        Args: {
          search_term: string
        }
        Returns: {
          analyzed_content: Json | null
          caption: string | null
          correlation_id: string | null
          created_at: string
          duration: number | null
          file_id: string | null
          file_size: number | null
          file_type: string | null
          file_unique_id: string | null
          glide_app_url: string | null
          glide_data: Json | null
          height: number | null
          id: string
          is_original_caption: boolean | null
          last_retry_at: string | null
          last_synced_at: string | null
          max_retries: number | null
          media_group_id: string | null
          media_group_size: number | null
          media_metadata: Json | null
          message_id: string
          message_media_data: Json | null
          mime_type: string | null
          notes: string | null
          original_message_id: string | null
          processed: boolean | null
          processed_at: string | null
          processing_error: string | null
          product_code: string | null
          product_name: string | null
          public_url: string | null
          purchase_date: string | null
          purchase_order_uid: string | null
          quantity: number | null
          retry_count: number | null
          status: string | null
          storage_path: string | null
          telegram_media_row_id: string | null
          updated_at: string
          vendor_uid: string | null
          width: number | null
        }[]
      }
      set_status_source: {
        Args: {
          source: string
        }
        Returns: undefined
      }
      sync_telegram_media_with_messages: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      update_media_records: {
        Args: {
          p_message_id: string
          p_public_url: string
          p_storage_path: string
          p_message_media_data: Json
        }
        Returns: undefined
      }
      update_message_media_data_url: {
        Args: {
          message_data: Json
          new_url: string
        }
        Returns: Json
      }
      update_public_urls: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      validate_media_groups: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      validate_storage_consistency: {
        Args: Record<PropertyKey, never>
        Returns: {
          inconsistent_records: number
          missing_files: number
          orphaned_files: number
        }[]
      }
    }
    Enums: {
      message_status: "pending" | "media_ready" | "processed" | "error"
    }
    CompositeTypes: {
      message_media_data_type: {
        message: Json | null
        sender: Json | null
        analysis: Json | null
        meta: Json | null
        media: Json | null
        telegram_data: Json | null
      }
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never