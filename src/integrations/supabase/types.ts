export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      appointment_documents: {
        Row: {
          appointment_id: string | null
          created_at: string
          created_by: string | null
          doc_type: string
          file_name: string
          file_url: string
          id: string
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          created_by?: string | null
          doc_type: string
          file_name: string
          file_url: string
          id?: string
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          created_by?: string | null
          doc_type?: string
          file_name?: string
          file_url?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_documents_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          acceptance_photos: Json | null
          car_make: string
          car_vin: string | null
          client_notified: boolean
          created_at: string
          id: string
          license_plate: string | null
          message: string | null
          mileage: number | null
          name: string
          parts_cost: number
          phone: string
          photos: Json | null
          service_type: string
          services: Json | null
          services_cost: number
          status: string
          total_price: number | null
          updated_at: string
          work_items: Json
        }
        Insert: {
          acceptance_photos?: Json | null
          car_make: string
          car_vin?: string | null
          client_notified?: boolean
          created_at?: string
          id?: string
          license_plate?: string | null
          message?: string | null
          mileage?: number | null
          name: string
          parts_cost?: number
          phone: string
          photos?: Json | null
          service_type: string
          services?: Json | null
          services_cost?: number
          status?: string
          total_price?: number | null
          updated_at?: string
          work_items?: Json
        }
        Update: {
          acceptance_photos?: Json | null
          car_make?: string
          car_vin?: string | null
          client_notified?: boolean
          created_at?: string
          id?: string
          license_plate?: string | null
          message?: string | null
          mileage?: number | null
          name?: string
          parts_cost?: number
          phone?: string
          photos?: Json | null
          service_type?: string
          services?: Json | null
          services_cost?: number
          status?: string
          total_price?: number | null
          updated_at?: string
          work_items?: Json
        }
        Relationships: []
      }
      bonus_transactions: {
        Row: {
          amount: number
          appointment_id: string | null
          client_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          type: string
        }
        Insert: {
          amount: number
          appointment_id?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          type: string
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "bonus_transactions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          bonus_points: number
          car_history: Json | null
          created_at: string
          id: string
          name: string | null
          phone: string
          telegram_chat_id: string | null
          telegram_username: string | null
          updated_at: string
        }
        Insert: {
          bonus_points?: number
          car_history?: Json | null
          created_at?: string
          id?: string
          name?: string | null
          phone: string
          telegram_chat_id?: string | null
          telegram_username?: string | null
          updated_at?: string
        }
        Update: {
          bonus_points?: number
          car_history?: Json | null
          created_at?: string
          id?: string
          name?: string | null
          phone?: string
          telegram_chat_id?: string | null
          telegram_username?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      portfolio: {
        Row: {
          car_details: Json | null
          car_make: string | null
          car_model: string | null
          car_year: number | null
          created_at: string
          description: string | null
          final_price: number | null
          id: string
          image_after_url: string | null
          image_before_url: string | null
          is_published: boolean
          mileage: number | null
          parts_list: Json | null
          review_id: string | null
          service_type: string | null
          title: string
          work_duration: string | null
          work_list: Json | null
        }
        Insert: {
          car_details?: Json | null
          car_make?: string | null
          car_model?: string | null
          car_year?: number | null
          created_at?: string
          description?: string | null
          final_price?: number | null
          id?: string
          image_after_url?: string | null
          image_before_url?: string | null
          is_published?: boolean
          mileage?: number | null
          parts_list?: Json | null
          review_id?: string | null
          service_type?: string | null
          title: string
          work_duration?: string | null
          work_list?: Json | null
        }
        Update: {
          car_details?: Json | null
          car_make?: string | null
          car_model?: string | null
          car_year?: number | null
          created_at?: string
          description?: string | null
          final_price?: number | null
          id?: string
          image_after_url?: string | null
          image_before_url?: string | null
          is_published?: boolean
          mileage?: number | null
          parts_list?: Json | null
          review_id?: string | null
          service_type?: string | null
          title?: string
          work_duration?: string | null
          work_list?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          full_name: string | null
          id: string
          is_approved: boolean
          is_blocked: boolean
          telegram_chat_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_approved?: boolean
          is_blocked?: boolean
          telegram_chat_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_approved?: boolean
          is_blocked?: boolean
          telegram_chat_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      promotions: {
        Row: {
          created_at: string
          description: string | null
          discount_value: string | null
          id: string
          image_url: string | null
          is_active: boolean
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_value?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_value?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      review_requests: {
        Row: {
          appointment_id: string | null
          created_at: string
          id: string
          scheduled_for: string
          sent: boolean
          sent_at: string | null
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          id?: string
          scheduled_for: string
          sent?: boolean
          sent_at?: string | null
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          id?: string
          scheduled_for?: string
          sent?: boolean
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_requests_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          appointment_id: string | null
          client_name: string | null
          created_at: string
          feedback: string | null
          id: string
          is_published: boolean
          phone: string | null
          rating: number
          review_requested_at: string | null
          telegram_chat_id: string | null
        }
        Insert: {
          appointment_id?: string | null
          client_name?: string | null
          created_at?: string
          feedback?: string | null
          id?: string
          is_published?: boolean
          phone?: string | null
          rating: number
          review_requested_at?: string | null
          telegram_chat_id?: string | null
        }
        Update: {
          appointment_id?: string | null
          client_name?: string | null
          created_at?: string
          feedback?: string | null
          id?: string
          is_published?: boolean
          phone?: string | null
          rating?: number
          review_requested_at?: string | null
          telegram_chat_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          id: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          id?: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          id?: string
          permission?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      security_audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          target_id: string | null
          target_table: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_table?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_table?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      service_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      services: {
        Row: {
          category: string | null
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          price_from: number
          price_to: number | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          price_from?: number
          price_to?: number | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price_from?: number
          price_to?: number | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      sheets_sync_log: {
        Row: {
          action: string
          appointment_id: string | null
          error_message: string | null
          id: string
          row_index: number | null
          success: boolean
          synced_at: string
        }
        Insert: {
          action: string
          appointment_id?: string | null
          error_message?: string | null
          id?: string
          row_index?: number | null
          success?: boolean
          synced_at?: string
        }
        Update: {
          action?: string
          appointment_id?: string | null
          error_message?: string | null
          id?: string
          row_index?: number | null
          success?: boolean
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sheets_sync_log_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      supply_orders: {
        Row: {
          appointment_id: string | null
          created_at: string
          id: string
          item_name: string
          master_id: string | null
          master_name: string
          notes: string | null
          notified: boolean
          quantity: number
          status: Database["public"]["Enums"]["supply_status"]
          supply_type: Database["public"]["Enums"]["supply_type"]
          unit: string | null
          updated_at: string
          urgency: Database["public"]["Enums"]["supply_urgency"]
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          id?: string
          item_name: string
          master_id?: string | null
          master_name: string
          notes?: string | null
          notified?: boolean
          quantity?: number
          status?: Database["public"]["Enums"]["supply_status"]
          supply_type?: Database["public"]["Enums"]["supply_type"]
          unit?: string | null
          updated_at?: string
          urgency?: Database["public"]["Enums"]["supply_urgency"]
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          id?: string
          item_name?: string
          master_id?: string | null
          master_name?: string
          notes?: string | null
          notified?: boolean
          quantity?: number
          status?: Database["public"]["Enums"]["supply_status"]
          supply_type?: Database["public"]["Enums"]["supply_type"]
          unit?: string | null
          updated_at?: string
          urgency?: Database["public"]["Enums"]["supply_urgency"]
        }
        Relationships: [
          {
            foreignKeyName: "supply_orders_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_sessions: {
        Row: {
          auth_date: number
          created_at: string
          first_name: string | null
          hash: string
          id: string
          last_active: string
          last_name: string | null
          phone: string | null
          photo_url: string | null
          session_token: string
          telegram_id: number
          username: string | null
        }
        Insert: {
          auth_date: number
          created_at?: string
          first_name?: string | null
          hash: string
          id?: string
          last_active?: string
          last_name?: string | null
          phone?: string | null
          photo_url?: string | null
          session_token?: string
          telegram_id: number
          username?: string | null
        }
        Update: {
          auth_date?: number
          created_at?: string
          first_name?: string | null
          hash?: string
          id?: string
          last_active?: string
          last_name?: string | null
          phone?: string | null
          photo_url?: string | null
          session_token?: string
          telegram_id?: number
          username?: string | null
        }
        Relationships: []
      }
      telegram_users: {
        Row: {
          chat_id: string
          created_at: string
          first_name: string | null
          id: string
          is_active: boolean
          last_name: string | null
          phone: string | null
          username: string | null
        }
        Insert: {
          chat_id: string
          created_at?: string
          first_name?: string | null
          id?: string
          is_active?: boolean
          last_name?: string | null
          phone?: string | null
          username?: string | null
        }
        Update: {
          chat_id?: string
          created_at?: string
          first_name?: string | null
          id?: string
          is_active?: boolean
          last_name?: string | null
          phone?: string | null
          username?: string | null
        }
        Relationships: []
      }
      user_group_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "user_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      user_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          permissions: Json
          telegram_chat_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          permissions?: Json
          telegram_chat_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          permissions?: Json
          telegram_chat_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_count: { Args: never; Returns: number }
      get_user_role: { Args: { _user_id: string }; Returns: string }
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_user_approved: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "master" | "manager"
      supply_status:
        | "pending"
        | "approved"
        | "ordered"
        | "received"
        | "cancelled"
      supply_type: "part" | "tool" | "consumable"
      supply_urgency: "urgent" | "planned"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "master", "manager"],
      supply_status: [
        "pending",
        "approved",
        "ordered",
        "received",
        "cancelled",
      ],
      supply_type: ["part", "tool", "consumable"],
      supply_urgency: ["urgent", "planned"],
    },
  },
} as const
