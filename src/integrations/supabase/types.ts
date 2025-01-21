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
      failed_webhook_updates: {
        Row: {
          chat_id: number | null
          created_at: string
          error_message: string
          error_stack: string | null
          id: string
          last_retry_at: string | null
          message_data: Json | null
          message_id: number | null
          retry_count: number | null
          status: string | null
          updated_at: string
        }
        Insert: {
          chat_id?: number | null
          created_at?: string
          error_message: string
          error_stack?: string | null
          id?: string
          last_retry_at?: string | null
          message_data?: Json | null
          message_id?: number | null
          retry_count?: number | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          chat_id?: number | null
          created_at?: string
          error_message?: string
          error_stack?: string | null
          id?: string
          last_retry_at?: string | null
          message_data?: Json | null
          message_id?: number | null
          retry_count?: number | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          caption: string | null
          chat_id: number
          created_at: string
          id: string
          last_retry_at: string | null
          media_group_id: string | null
          message_data: Json
          message_id: number
          message_type: string
          processed_at: string | null
          processing_error: string | null
          product_code: string | null
          product_name: string | null
          quantity: number | null
          retry_count: number | null
          sender_info: Json
          status: string | null
          updated_at: string
        }
        Insert: {
          caption?: string | null
          chat_id: number
          created_at?: string
          id?: string
          last_retry_at?: string | null
          media_group_id?: string | null
          message_data?: Json
          message_id: number
          message_type: string
          processed_at?: string | null
          processing_error?: string | null
          product_code?: string | null
          product_name?: string | null
          quantity?: number | null
          retry_count?: number | null
          sender_info?: Json
          status?: string | null
          updated_at?: string
        }
        Update: {
          caption?: string | null
          chat_id?: number
          created_at?: string
          id?: string
          last_retry_at?: string | null
          media_group_id?: string | null
          message_data?: Json
          message_id?: number
          message_type?: string
          processed_at?: string | null
          processing_error?: string | null
          product_code?: string | null
          product_name?: string | null
          quantity?: number | null
          retry_count?: number | null
          sender_info?: Json
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      telegram_media: {
        Row: {
          caption: string | null
          created_at: string
          file_id: string
          file_type: string
          file_unique_id: string
          glide_data: Json
          id: string
          last_synced_at: string | null
          media_metadata: Json
          message_id: string | null
          processed: boolean | null
          processing_error: string | null
          product_code: string | null
          product_name: string | null
          public_url: string | null
          purchase_date: string | null
          quantity: number | null
          telegram_data: Json
          updated_at: string
          vendor_uid: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          file_id: string
          file_type: string
          file_unique_id: string
          glide_data?: Json
          id?: string
          last_synced_at?: string | null
          media_metadata?: Json
          message_id?: string | null
          processed?: boolean | null
          processing_error?: string | null
          product_code?: string | null
          product_name?: string | null
          public_url?: string | null
          purchase_date?: string | null
          quantity?: number | null
          telegram_data?: Json
          updated_at?: string
          vendor_uid?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          file_id?: string
          file_type?: string
          file_unique_id?: string
          glide_data?: Json
          id?: string
          last_synced_at?: string | null
          media_metadata?: Json
          message_id?: string | null
          processed?: boolean | null
          processing_error?: string | null
          product_code?: string | null
          product_name?: string | null
          public_url?: string | null
          purchase_date?: string | null
          quantity?: number | null
          telegram_data?: Json
          updated_at?: string
          vendor_uid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_media_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      duplicate_messages: {
        Row: {
          created_dates: string[] | null
          file_id: string | null
          message_ids: string[] | null
        }
        Relationships: []
      }
    }
    Functions: {
      cleanup_successful_webhooks: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      get_message_file_id: {
        Args: {
          message_data: Json
        }
        Returns: string
      }
      process_message_transaction: {
        Args: {
          p_message_id: number
          p_chat_id: number
          p_sender_info: Json
          p_message_type: string
          p_message_data: Json
          p_caption: string
          p_media_group_id: string
          p_product_name: string
          p_product_code: string
          p_quantity: number
          p_status: string
        }
        Returns: {
          id: string
          message_id: number
          chat_id: number
          sender_info: Json
          message_type: string
          message_data: Json
          caption: string
          media_group_id: string
          product_name: string
          product_code: string
          quantity: number
          status: string
          retry_count: number
          last_retry_at: string
          processing_error: string
          processed_at: string
          created_at: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
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
