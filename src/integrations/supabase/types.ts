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
      collected_content: {
        Row: {
          created_at: string | null
          id: string
          twitter_data: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          twitter_data?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          twitter_data?: string | null
        }
        Relationships: []
      }
      memory_context: {
        Row: {
          created_at: string
          id: string
          mediumterm_context: string | null
          shortterm_context1: string | null
          shortterm_context2: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          mediumterm_context?: string | null
          shortterm_context1?: string | null
          shortterm_context2?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          mediumterm_context?: string | null
          shortterm_context1?: string | null
          shortterm_context2?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      newsletters: {
        Row: {
          content: string
          created_at: string | null
          id: string
          newsletter_date: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          newsletter_date?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          newsletter_date?: string | null
        }
        Relationships: []
      }
      tweetgenerationflow: {
        Row: {
          created_at: string
          deepinitial: string | null
          geminiobservation: string | null
          id: string
          sonardeepresearch: string | null
          sonarfactchecked: string | null
          vectorcontext: string | null
        }
        Insert: {
          created_at?: string
          deepinitial?: string | null
          geminiobservation?: string | null
          id?: string
          sonardeepresearch?: string | null
          sonarfactchecked?: string | null
          vectorcontext?: string | null
        }
        Update: {
          created_at?: string
          deepinitial?: string | null
          geminiobservation?: string | null
          id?: string
          sonardeepresearch?: string | null
          sonarfactchecked?: string | null
          vectorcontext?: string | null
        }
        Relationships: []
      }
      unrefined: {
        Row: {
          created_at: string
          id: string
          shortterm_context1_unrefined: string | null
          shortterm_context2_unrefined: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          shortterm_context1_unrefined?: string | null
          shortterm_context2_unrefined?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          shortterm_context1_unrefined?: string | null
          shortterm_context2_unrefined?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
