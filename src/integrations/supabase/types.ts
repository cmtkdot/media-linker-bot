// Re-export types from Supabase functions
export type {
  GlideConfig,
  GlideResponse,
  GlideSyncQueueItem,
  GlideTableSchema,
  SyncResult,
  TelegramMedia,
  WebhookUpdate,
  TelegramMessage,
  TelegramUser,
  TelegramChat,
  TelegramPhotoSize,
  TelegramVideo,
  TelegramDocument,
  TelegramAnimation
} from '../../../supabase/functions/_shared/types';

// Database types
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      failed_webhook_updates: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          raw_update: Json | null
          retry_count: number
          status: string
          update_id: number | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          raw_update?: Json | null
          retry_count?: number
          status?: string
          update_id?: number | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          raw_update?: Json | null
          retry_count?: number
          status?: string
          update_id?: number | null
        }
        Relationships: []
      }
      glide_config: {
        Row: {
          active: boolean
          api_token: string
          app_id: string
          created_at: string
          id: string
          supabase_table_name: string | null
          table_id: string
          table_name: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean
          api_token: string
          app_id: string
          created_at?: string
          id?: string
          supabase_table_name?: string | null
          table_id: string
          table_name: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          api_token?: string
          app_id?: string
          created_at?: string
          id?: string
          supabase_table_name?: string | null
          table_id?: string
          table_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      glide_sync_queue: {
        Row: {
          created_at: string
          error: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          operation: string
          processed_at: string | null
          record_id: string
          retry_count: number
          table_name: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          operation: string
          processed_at?: string | null
          record_id: string
          retry_count?: number
          table_name: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          operation?: string
          processed_at?: string | null
          record_id?: string
          retry_count?: number
          table_name?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          analyzed_content: Json | null
          caption: string | null
          chat_id: number
          created_at: string
          error_message: string | null
          id: string
          media_group_id: string | null
          message_data: Json
          message_id: number
          message_type: string
          notes: string | null
          product_code: string | null
          product_name: string | null
          purchase_date: string | null
          purchase_order_uid: string | null
          quantity: number | null
          retry_count: number
          sender_info: Json
          status: string
          updated_at: string | null
          vendor_uid: string | null
        }
        Insert: {
          analyzed_content?: Json | null
          caption?: string | null
          chat_id: number
          created_at?: string
          error_message?: string | null
          id?: string
          media_group_id?: string | null
          message_data: Json
          message_id: number
          message_type: string
          notes?: string | null
          product_code?: string | null
          product_name?: string | null
          purchase_date?: string | null
          purchase_order_uid?: string | null
          quantity?: number | null
          retry_count?: number
          sender_info: Json
          status?: string
          updated_at?: string | null
          vendor_uid?: string | null
        }
        Update: {
          analyzed_content?: Json | null
          caption?: string | null
          chat_id?: number
          created_at?: string
          error_message?: string | null
          id?: string
          media_group_id?: string | null
          message_data?: Json
          message_id?: number
          message_type?: string
          notes?: string | null
          product_code?: string | null
          product_name?: string | null
          purchase_date?: string | null
          purchase_order_uid?: string | null
          quantity?: number | null
          retry_count?: number
          sender_info?: Json
          status?: string
          updated_at?: string | null
          vendor_uid?: string | null
        }
        Relationships: []
      }
      telegram_media: {
        Row: {
          analyzed_content: Json | null
          caption: string | null
          created_at: string
          default_public_url: string | null
          file_id: string
          file_type: string
          file_unique_id: string
          glide_data: Json
          id: string
          last_synced_at: string | null
          media_metadata: Json
          message_id: string | null
          notes: string | null
          processed: boolean
          processing_error: string | null
          product_code: string | null
          product_name: string | null
          public_url: string | null
          purchase_date: string | null
          purchase_order_uid: string | null
          quantity: number | null
          telegram_data: Json
          telegram_media_row_id: string | null
          updated_at: string | null
          vendor_uid: string | null
        }
        Insert: {
          analyzed_content?: Json | null
          caption?: string | null
          created_at?: string
          default_public_url?: string | null
          file_id: string
          file_type: string
          file_unique_id: string
          glide_data?: Json
          id?: string
          last_synced_at?: string | null
          media_metadata?: Json
          message_id?: string | null
          notes?: string | null
          processed?: boolean
          processing_error?: string | null
          product_code?: string | null
          product_name?: string | null
          public_url?: string | null
          purchase_date?: string | null
          purchase_order_uid?: string | null
          quantity?: number | null
          telegram_data?: Json
          telegram_media_row_id?: string | null
          updated_at?: string | null
          vendor_uid?: string | null
        }
        Update: {
          analyzed_content?: Json | null
          caption?: string | null
          created_at?: string
          default_public_url?: string | null
          file_id?: string
          file_type?: string
          file_unique_id?: string
          glide_data?: Json
          id?: string
          last_synced_at?: string | null
          media_metadata?: Json
          message_id?: string | null
          notes?: string | null
          processed?: boolean
          processing_error?: string | null
          product_code?: string | null
          product_name?: string | null
          public_url?: string | null
          purchase_date?: string | null
          purchase_order_uid?: string | null
          quantity?: number | null
          telegram_data?: Json
          telegram_media_row_id?: string | null
          updated_at?: string | null
          vendor_uid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_media_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_glide_sync_table: {
        Args: {
          table_name: string
        }
        Returns: boolean
      }
      get_all_tables: {
        Args: Record<PropertyKey, never>
        Returns: {
          table_name: string
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

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (Database["public"]["Tables"] & Database["public"]["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"] &
      Database["public"]["Views"])
  ? (Database["public"]["Tables"] &
      Database["public"]["Views"])[PublicTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
  ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
  ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof Database["public"]["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof Database["public"]["Enums"]
  ? Database["public"]["Enums"][PublicEnumNameOrOptions]
  : never