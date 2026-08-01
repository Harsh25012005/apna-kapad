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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bills: {
        Row: {
          created_at: string
          customer_id: string
          discount: number
          fabric_cost: number
          id: string
          order_id: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          shop_id: string
          stitching_charge: number
          tax: number
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          discount?: number
          fabric_cost?: number
          id?: string
          order_id?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          shop_id: string
          stitching_charge?: number
          tax?: number
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          discount?: number
          fabric_cost?: number
          id?: string
          order_id?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          shop_id?: string
          stitching_charge?: number
          tax?: number
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bills_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          book_number: string | null
          created_at: string
          id: string
          name: string
          phone: string | null
          shop_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          book_number?: string | null
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          shop_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          book_number?: string | null
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      device_tokens: {
        Row: {
          created_at: string
          expo_push_token: string
          id: string
          platform: string
          shop_id: string
          staff_id: string | null
        }
        Insert: {
          created_at?: string
          expo_push_token: string
          id?: string
          platform: string
          shop_id: string
          staff_id?: string | null
        }
        Update: {
          created_at?: string
          expo_push_token?: string
          id?: string
          platform?: string
          shop_id?: string
          staff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "device_tokens_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_tokens_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      measurements: {
        Row: {
          chest: number | null
          custom_fields: Json
          customer_id: string
          garment_type: string
          id: string
          length: number | null
          notes: string | null
          pant_cloth: number | null
          shirt_cloth: number | null
          shop_id: string
          shoulder: number | null
          sleeve: number | null
          updated_at: string
          waist: number | null
        }
        Insert: {
          chest?: number | null
          custom_fields?: Json
          customer_id: string
          garment_type: string
          id?: string
          length?: number | null
          notes?: string | null
          pant_cloth?: number | null
          shirt_cloth?: number | null
          shop_id: string
          shoulder?: number | null
          sleeve?: number | null
          updated_at?: string
          waist?: number | null
        }
        Update: {
          chest?: number | null
          custom_fields?: Json
          customer_id?: string
          garment_type?: string
          id?: string
          length?: number | null
          notes?: string | null
          pant_cloth?: number | null
          shirt_cloth?: number | null
          shop_id?: string
          shoulder?: number | null
          sleeve?: number | null
          updated_at?: string
          waist?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "measurements_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "measurements_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications_log: {
        Row: {
          customer_id: string | null
          id: string
          sent_at: string | null
          shop_id: string
          status: Database["public"]["Enums"]["notification_status"]
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          customer_id?: string | null
          id?: string
          sent_at?: string | null
          shop_id: string
          status?: Database["public"]["Enums"]["notification_status"]
          type: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          customer_id?: string | null
          id?: string
          sent_at?: string | null
          shop_id?: string
          status?: Database["public"]["Enums"]["notification_status"]
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "notifications_log_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_log_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          cloth_count: number
          created_at: string
          garment_type: string
          id: string
          measurement_id: string | null
          notes: string | null
          order_id: string
          shop_id: string
          unit_price: number
        }
        Insert: {
          cloth_count?: number
          created_at?: string
          garment_type: string
          id?: string
          measurement_id?: string | null
          notes?: string | null
          order_id: string
          shop_id: string
          unit_price?: number
        }
        Update: {
          cloth_count?: number
          created_at?: string
          garment_type?: string
          id?: string
          measurement_id?: string | null
          notes?: string | null
          order_id?: string
          shop_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_measurement_id_fkey"
            columns: ["measurement_id"]
            isOneToOne: false
            referencedRelation: "measurements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          assigned_staff_id: string | null
          bill_book_number: string | null
          cloth_count: number | null
          cloth_type: string | null
          created_at: string
          customer_id: string
          delivery_date: string | null
          design_photo_url: string | null
          design_photo_urls: string[]
          id: string
          is_rush: boolean
          measurement_id: string | null
          order_date: string
          order_number: string
          paid_amount: number
          payment_mode: string | null
          priority: Database["public"]["Enums"]["order_priority"]
          rush_fee: number | null
          shop_id: string
          status: Database["public"]["Enums"]["order_status"]
          total_amount: number | null
          trial_date: string | null
          updated_at: string
        }
        Insert: {
          assigned_staff_id?: string | null
          bill_book_number?: string | null
          cloth_count?: number | null
          cloth_type?: string | null
          created_at?: string
          customer_id: string
          delivery_date?: string | null
          design_photo_url?: string | null
          design_photo_urls?: string[]
          id?: string
          is_rush?: boolean
          measurement_id?: string | null
          order_date?: string
          order_number: string
          paid_amount?: number
          payment_mode?: string | null
          priority?: Database["public"]["Enums"]["order_priority"]
          rush_fee?: number | null
          shop_id: string
          status?: Database["public"]["Enums"]["order_status"]
          total_amount?: number | null
          trial_date?: string | null
          updated_at?: string
        }
        Update: {
          assigned_staff_id?: string | null
          bill_book_number?: string | null
          cloth_count?: number | null
          cloth_type?: string | null
          created_at?: string
          customer_id?: string
          delivery_date?: string | null
          design_photo_url?: string | null
          design_photo_urls?: string[]
          id?: string
          is_rush?: boolean
          measurement_id?: string | null
          order_date?: string
          order_number?: string
          paid_amount?: number
          payment_mode?: string | null
          priority?: Database["public"]["Enums"]["order_priority"]
          rush_fee?: number | null
          shop_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          total_amount?: number | null
          trial_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_assigned_staff_id_fkey"
            columns: ["assigned_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_measurement_id_fkey"
            columns: ["measurement_id"]
            isOneToOne: false
            referencedRelation: "measurements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_paid: number
          bill_id: string
          customer_id: string
          id: string
          payment_date: string
          payment_mode: string | null
          shop_id: string
        }
        Insert: {
          amount_paid: number
          bill_id: string
          customer_id: string
          id?: string
          payment_date?: string
          payment_mode?: string | null
          shop_id: string
        }
        Update: {
          amount_paid?: number
          bill_id?: string
          customer_id?: string
          id?: string
          payment_date?: string
          payment_mode?: string | null
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          address: string | null
          created_at: string
          has_seen_guide: boolean
          has_tailoring: boolean
          id: string
          logo_url: string | null
          onboarding_checklist: Json
          owner_id: string
          owner_name: string
          phone: string | null
          primary_color: string
          rush_fee_percent: number
          shop_name: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          has_seen_guide?: boolean
          has_tailoring?: boolean
          id?: string
          logo_url?: string | null
          onboarding_checklist?: Json
          owner_id: string
          owner_name: string
          phone?: string | null
          primary_color?: string
          rush_fee_percent?: number
          shop_name: string
        }
        Update: {
          address?: string | null
          created_at?: string
          has_seen_guide?: boolean
          has_tailoring?: boolean
          id?: string
          logo_url?: string | null
          onboarding_checklist?: Json
          owner_id?: string
          owner_name?: string
          phone?: string | null
          primary_color?: string
          rush_fee_percent?: number
          shop_name?: string
        }
        Relationships: []
      }
      staff: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          phone: string | null
          role: string | null
          shop_id: string
          updated_at: string
          wage_amount: number
          wage_amount_pair: number | null
          wage_amount_pant: number | null
          wage_amount_shirt: number | null
          wage_type: Database["public"]["Enums"]["wage_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          role?: string | null
          shop_id: string
          updated_at?: string
          wage_amount?: number
          wage_amount_pair?: number | null
          wage_amount_pant?: number | null
          wage_amount_shirt?: number | null
          wage_type?: Database["public"]["Enums"]["wage_type"]
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          role?: string | null
          shop_id?: string
          updated_at?: string
          wage_amount?: number
          wage_amount_pair?: number | null
          wage_amount_pant?: number | null
          wage_amount_shirt?: number | null
          wage_type?: Database["public"]["Enums"]["wage_type"]
        }
        Relationships: [
          {
            foreignKeyName: "staff_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_leave: {
        Row: {
          created_at: string
          id: string
          leave_date: string
          reason: string | null
          shop_id: string
          staff_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          leave_date: string
          reason?: string | null
          shop_id: string
          staff_id: string
        }
        Update: {
          created_at?: string
          id?: string
          leave_date?: string
          reason?: string | null
          shop_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_leave_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_leave_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_orders: {
        Row: {
          assigned_at: string | null
          completed_at: string | null
          id: string
          order_id: string
          shop_id: string
          staff_id: string
          task: string | null
        }
        Insert: {
          assigned_at?: string | null
          completed_at?: string | null
          id?: string
          order_id: string
          shop_id: string
          staff_id: string
          task?: string | null
        }
        Update: {
          assigned_at?: string | null
          completed_at?: string | null
          id?: string
          order_id?: string
          shop_id?: string
          staff_id?: string
          task?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_orders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_orders_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_work_entries: {
        Row: {
          created_at: string
          id: string
          quantity: number
          rate_applied: number
          shop_id: string
          staff_id: string
          work_date: string
          work_type: Database["public"]["Enums"]["work_item_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          quantity?: number
          rate_applied?: number
          shop_id: string
          staff_id: string
          work_date?: string
          work_type: Database["public"]["Enums"]["work_item_type"]
        }
        Update: {
          created_at?: string
          id?: string
          quantity?: number
          rate_applied?: number
          shop_id?: string
          staff_id?: string
          work_date?: string
          work_type?: Database["public"]["Enums"]["work_item_type"]
        }
        Relationships: [
          {
            foreignKeyName: "staff_work_entries_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_work_entries_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      till_entries: {
        Row: {
          cash_out: number
          closing_cash: number | null
          created_at: string
          entry_date: string
          id: string
          notes: string | null
          opening_cash: number
          reconciled_by: string | null
          shop_id: string
        }
        Insert: {
          cash_out?: number
          closing_cash?: number | null
          created_at?: string
          entry_date?: string
          id?: string
          notes?: string | null
          opening_cash?: number
          reconciled_by?: string | null
          shop_id: string
        }
        Update: {
          cash_out?: number
          closing_cash?: number | null
          created_at?: string
          entry_date?: string
          id?: string
          notes?: string | null
          opening_cash?: number
          reconciled_by?: string | null
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "till_entries_reconciled_by_fkey"
            columns: ["reconciled_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "till_entries_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_shop_id: { Args: never; Returns: string }
    }
    Enums: {
      notification_status: "pending" | "sent" | "failed"
      notification_type: "order_ready" | "payment_due"
      order_priority: "normal" | "urgent"
      order_status:
        | "order_taken"
        | "cutting"
        | "stitching"
        | "ready"
        | "delivered"
      payment_status: "paid" | "partial" | "unpaid"
      wage_type: "daily" | "monthly" | "per_piece"
      work_item_type: "pant" | "shirt" | "pant_shirt"
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
      notification_status: ["pending", "sent", "failed"],
      notification_type: ["order_ready", "payment_due"],
      order_priority: ["normal", "urgent"],
      order_status: [
        "order_taken",
        "cutting",
        "stitching",
        "ready",
        "delivered",
      ],
      payment_status: ["paid", "partial", "unpaid"],
      wage_type: ["daily", "monthly", "per_piece"],
      work_item_type: ["pant", "shirt", "pant_shirt"],
    },
  },
} as const
