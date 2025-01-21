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
          quantity: number | null
          telegram_data: Json
          updated_at: string
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
          quantity?: number | null
          telegram_data?: Json
          updated_at?: string
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
          quantity?: number | null
          telegram_data?: Json
          updated_at?: string
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
      [_ in never]: never
    }
    Functions: {
      cleanup_successful_webhooks: {
        Args: Record<PropertyKey, never>
        Returns: undefined
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
