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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      architecture_firms: {
        Row: {
          discipline: string | null
          documented_detroit_work: string | null
          id: string
          likely_fit: string | null
          name: string
          source_url: string | null
        }
        Insert: {
          discipline?: string | null
          documented_detroit_work?: string | null
          id?: string
          likely_fit?: string | null
          name: string
          source_url?: string | null
        }
        Update: {
          discipline?: string | null
          documented_detroit_work?: string | null
          id?: string
          likely_fit?: string | null
          name?: string
          source_url?: string | null
        }
        Relationships: []
      }
      config: {
        Row: {
          key: string
          value: Json
        }
        Insert: {
          key: string
          value: Json
        }
        Update: {
          key?: string
          value?: Json
        }
        Relationships: []
      }
      contacts: {
        Row: {
          channel_type: string | null
          channel_value: string | null
          created_at: string | null
          helps_with: string | null
          id: string
          last_verified_at: string | null
          name: string
          notes: string | null
          source_url: string | null
          type: string
          use_when: string | null
        }
        Insert: {
          channel_type?: string | null
          channel_value?: string | null
          created_at?: string | null
          helps_with?: string | null
          id?: string
          last_verified_at?: string | null
          name: string
          notes?: string | null
          source_url?: string | null
          type: string
          use_when?: string | null
        }
        Update: {
          channel_type?: string | null
          channel_value?: string | null
          created_at?: string | null
          helps_with?: string | null
          id?: string
          last_verified_at?: string | null
          name?: string
          notes?: string | null
          source_url?: string | null
          type?: string
          use_when?: string | null
        }
        Relationships: []
      }
      daily_send_counts: {
        Row: {
          count: number
          day: string
          user_id: string
        }
        Insert: {
          count?: number
          day: string
          user_id: string
        }
        Update: {
          count?: number
          day?: string
          user_id?: string
        }
        Relationships: []
      }
      data_sources: {
        Row: {
          id: string
          name: string
          notes: string | null
          url: string | null
        }
        Insert: {
          id?: string
          name: string
          notes?: string | null
          url?: string | null
        }
        Update: {
          id?: string
          name?: string
          notes?: string | null
          url?: string | null
        }
        Relationships: []
      }
      drafts: {
        Row: {
          body: string | null
          contact_id: string | null
          created_at: string | null
          id: string
          project_id: string | null
          purpose: string | null
          status: string
          subject: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          contact_id?: string | null
          created_at?: string | null
          id?: string
          project_id?: string | null
          purpose?: string | null
          status?: string
          subject?: string | null
          user_id?: string
        }
        Update: {
          body?: string | null
          contact_id?: string | null
          created_at?: string | null
          id?: string
          project_id?: string | null
          purpose?: string | null
          status?: string
          subject?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drafts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drafts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          message_id: string
          rating: number
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          message_id: string
          rating: number
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          message_id?: string
          rating?: number
        }
        Relationships: []
      }
      glossary: {
        Row: {
          definition: string
          id: string
          learn_more_url: string | null
          status: string
          term: string
        }
        Insert: {
          definition: string
          id?: string
          learn_more_url?: string | null
          status?: string
          term: string
        }
        Update: {
          definition?: string
          id?: string
          learn_more_url?: string | null
          status?: string
          term?: string
        }
        Relationships: []
      }
      project_checklists: {
        Row: {
          project_id: string
          step_state: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          project_id: string
          step_state?: Json
          updated_at?: string | null
          user_id?: string
        }
        Update: {
          project_id?: string
          step_state?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_checklists_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          address: string | null
          created_at: string | null
          id: string
          intended_use: string
          parcel_id: string | null
          project_type: string
          size: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          id?: string
          intended_use: string
          parcel_id?: string | null
          project_type: string
          size?: string | null
          user_id?: string
        }
        Update: {
          address?: string | null
          created_at?: string | null
          id?: string
          intended_use?: string
          parcel_id?: string | null
          project_type?: string
          size?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rules: {
        Row: {
          approval_name: string
          documents_needed: Json | null
          id: string
          is_sample: boolean | null
          last_verified_at: string | null
          notes: string | null
          office: string | null
          project_type: string
          source_url: string | null
          step_order: number
          submit_where: string | null
          use_category: string
        }
        Insert: {
          approval_name: string
          documents_needed?: Json | null
          id?: string
          is_sample?: boolean | null
          last_verified_at?: string | null
          notes?: string | null
          office?: string | null
          project_type: string
          source_url?: string | null
          step_order: number
          submit_where?: string | null
          use_category: string
        }
        Update: {
          approval_name?: string
          documents_needed?: Json | null
          id?: string
          is_sample?: boolean | null
          last_verified_at?: string | null
          notes?: string | null
          office?: string | null
          project_type?: string
          source_url?: string | null
          step_order?: number
          submit_where?: string | null
          use_category?: string
        }
        Relationships: []
      }
      submission_log: {
        Row: {
          action: string
          contact_id: string | null
          id: string
          notes: string | null
          occurred_at: string
          project_id: string | null
          reminder_date: string | null
          user_id: string
        }
        Insert: {
          action: string
          contact_id?: string | null
          id?: string
          notes?: string | null
          occurred_at?: string
          project_id?: string | null
          reminder_date?: string | null
          user_id?: string
        }
        Update: {
          action?: string
          contact_id?: string | null
          id?: string
          notes?: string | null
          occurred_at?: string
          project_id?: string | null
          reminder_date?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submission_log_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submission_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_call_log: {
        Row: {
          id: string
          ran_at: string | null
          success: boolean
          tool_name: string
        }
        Insert: {
          id?: string
          ran_at?: string | null
          success: boolean
          tool_name: string
        }
        Update: {
          id?: string
          ran_at?: string | null
          success?: boolean
          tool_name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "user"],
    },
  },
} as const
