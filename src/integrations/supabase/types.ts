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
            referencedRelation: "message_media_view"
            referencedColumns: ["telegram_media_id"]
          },
          {
            foreignKeyName: "glide_sync_queue_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "telegram_media"
            referencedColumns: ["id"]
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
          id: string
          last_retry_at: string | null
          media_group_id: string | null
          message_id: number
          message_media_data: Json | null
          message_type: string
          message_url: string | null
          notes: string | null
          processed_at: string | null
          processing_error: string | null
          product_code: string | null
          product_name: string | null
          purchase_date: string | null
          quantity: number | null
          retry_count: number | null
          sender_info: Json
          status: string | null
          telegram_data: Json
          updated_at: string
          vendor_uid: string | null
        }
        Insert: {
          analyzed_content?: Json | null
          caption?: string | null
          chat_id: number
          correlation_id?: string | null
          created_at?: string
          id?: string
          last_retry_at?: string | null
          media_group_id?: string | null
          message_id: number
          message_media_data?: Json | null
          message_type: string
          message_url?: string | null
          notes?: string | null
          processed_at?: string | null
          processing_error?: string | null
          product_code?: string | null
          product_name?: string | null
          purchase_date?: string | null
          quantity?: number | null
          retry_count?: number | null
          sender_info?: Json
          status?: string | null
          telegram_data?: Json
          updated_at?: string
          vendor_uid?: string | null
        }
        Update: {
          analyzed_content?: Json | null
          caption?: string | null
          chat_id?: number
          correlation_id?: string | null
          created_at?: string
          id?: string
          last_retry_at?: string | null
          media_group_id?: string | null
          message_id?: number
          message_media_data?: Json | null
          message_type?: string
          message_url?: string | null
          notes?: string | null
          processed_at?: string | null
          processing_error?: string | null
          product_code?: string | null
          product_name?: string | null
          purchase_date?: string | null
          quantity?: number | null
          retry_count?: number | null
          sender_info?: Json
          status?: string | null
          telegram_data?: Json
          updated_at?: string
          vendor_uid?: string | null
        }
        Relationships: []
      }
      telegram_media: {
        Row: {
          analyzed_content: Json | null
          caption: string | null
          created_at: string
          file_id: string
          file_type: string
          file_unique_id: string
          glide_app_url: string | null
          glide_data: Json
          glide_json: Json | null
          id: string
          is_original_caption: boolean | null
          last_synced_at: string | null
          media_metadata: Json
          message_data: Json | null
          message_id: string
          message_media_data: Json | null
          message_url: string | null
          notes: string | null
          original_message_id: string | null
          processed: boolean | null
          processing_error: string | null
          product_code: string | null
          product_name: string | null
          public_url: string | null
          purchase_date: string | null
          purchase_order_uid: string | null
          quantity: number | null
          sender_info: Json | null
          supabase_json: Json | null
          telegram_data: Json
          telegram_media_row_id: string | null
          updated_at: string
          vendor_uid: string | null
        }
        Insert: {
          analyzed_content?: Json | null
          caption?: string | null
          created_at?: string
          file_id: string
          file_type: string
          file_unique_id: string
          glide_app_url?: string | null
          glide_data?: Json
          glide_json?: Json | null
          id?: string
          is_original_caption?: boolean | null
          last_synced_at?: string | null
          media_metadata?: Json
          message_data?: Json | null
          message_id: string
          message_media_data?: Json | null
          message_url?: string | null
          notes?: string | null
          original_message_id?: string | null
          processed?: boolean | null
          processing_error?: string | null
          product_code?: string | null
          product_name?: string | null
          public_url?: string | null
          purchase_date?: string | null
          purchase_order_uid?: string | null
          quantity?: number | null
          sender_info?: Json | null
          supabase_json?: Json | null
          telegram_data?: Json
          telegram_media_row_id?: string | null
          updated_at?: string
          vendor_uid?: string | null
        }
        Update: {
          analyzed_content?: Json | null
          caption?: string | null
          created_at?: string
          file_id?: string
          file_type?: string
          file_unique_id?: string
          glide_app_url?: string | null
          glide_data?: Json
          glide_json?: Json | null
          id?: string
          is_original_caption?: boolean | null
          last_synced_at?: string | null
          media_metadata?: Json
          message_data?: Json | null
          message_id?: string
          message_media_data?: Json | null
          message_url?: string | null
          notes?: string | null
          original_message_id?: string | null
          processed?: boolean | null
          processing_error?: string | null
          product_code?: string | null
          product_name?: string | null
          public_url?: string | null
          purchase_date?: string | null
          purchase_order_uid?: string | null
          quantity?: number | null
          sender_info?: Json | null
          supabase_json?: Json | null
          telegram_data?: Json
          telegram_media_row_id?: string | null
          updated_at?: string
          vendor_uid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_media_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: true
            referencedRelation: "message_media_view"
            referencedColumns: ["message_id"]
          },
          {
            foreignKeyName: "telegram_media_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: true
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telegram_media_original_message_id_fkey"
            columns: ["original_message_id"]
            isOneToOne: false
            referencedRelation: "message_media_view"
            referencedColumns: ["message_id"]
          },
          {
            foreignKeyName: "telegram_media_original_message_id_fkey"
            columns: ["original_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      unified_processing_queue: {
        Row: {
          chat_id: number | null
          correlation_id: string | null
          created_at: string | null
          data: Json
          error_message: string | null
          id: string
          max_retries: number | null
          message_id: number | null
          message_media_data: Json | null
          priority: number | null
          processed_at: string | null
          queue_type: string
          retry_count: number | null
          status: string
        }
        Insert: {
          chat_id?: number | null
          correlation_id?: string | null
          created_at?: string | null
          data?: Json
          error_message?: string | null
          id?: string
          max_retries?: number | null
          message_id?: number | null
          message_media_data?: Json | null
          priority?: number | null
          processed_at?: string | null
          queue_type: string
          retry_count?: number | null
          status?: string
        }
        Update: {
          chat_id?: number | null
          correlation_id?: string | null
          created_at?: string | null
          data?: Json
          error_message?: string | null
          id?: string
          max_retries?: number | null
          message_id?: number | null
          message_media_data?: Json | null
          priority?: number | null
          processed_at?: string | null
          queue_type?: string
          retry_count?: number | null
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      message_media_view: {
        Row: {
          analyzed_content: Json | null
          message_content: string | null
          message_id: string | null
          telegram_data: Json | null
          telegram_media_id: string | null
          telegram_media_url: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      cleanup_processed_queue_items: {
        Args: Record<PropertyKey, never>
        Returns: undefined
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
      handle_retry_logic: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      is_media_group_synced: {
        Args: {
          group_id: string
        }
        Returns: boolean
      }
      search_telegram_media: {
        Args: {
          search_term: string
        }
        Returns: {
          analyzed_content: Json | null
          caption: string | null
          created_at: string
          file_id: string
          file_type: string
          file_unique_id: string
          glide_app_url: string | null
          glide_data: Json
          glide_json: Json | null
          id: string
          is_original_caption: boolean | null
          last_synced_at: string | null
          media_metadata: Json
          message_data: Json | null
          message_id: string
          message_media_data: Json | null
          message_url: string | null
          notes: string | null
          original_message_id: string | null
          processed: boolean | null
          processing_error: string | null
          product_code: string | null
          product_name: string | null
          public_url: string | null
          purchase_date: string | null
          purchase_order_uid: string | null
          quantity: number | null
          sender_info: Json | null
          supabase_json: Json | null
          telegram_data: Json
          telegram_media_row_id: string | null
          updated_at: string
          vendor_uid: string | null
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
