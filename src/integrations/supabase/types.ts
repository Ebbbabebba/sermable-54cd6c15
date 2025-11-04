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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      practice_sessions: {
        Row: {
          analysis: string | null
          connector_words: Json | null
          created_at: string
          cue_text: string | null
          delayed_words: string[] | null
          difficulty_score: number | null
          duration: number | null
          filler_words: Json | null
          id: string
          missed_words: string[] | null
          score: number | null
          session_date: string
          speech_id: string
          tone_feedback: string | null
          transcription: string | null
        }
        Insert: {
          analysis?: string | null
          connector_words?: Json | null
          created_at?: string
          cue_text?: string | null
          delayed_words?: string[] | null
          difficulty_score?: number | null
          duration?: number | null
          filler_words?: Json | null
          id?: string
          missed_words?: string[] | null
          score?: number | null
          session_date?: string
          speech_id: string
          tone_feedback?: string | null
          transcription?: string | null
        }
        Update: {
          analysis?: string | null
          connector_words?: Json | null
          created_at?: string
          cue_text?: string | null
          delayed_words?: string[] | null
          difficulty_score?: number | null
          duration?: number | null
          filler_words?: Json | null
          id?: string
          missed_words?: string[] | null
          score?: number | null
          session_date?: string
          speech_id?: string
          tone_feedback?: string | null
          transcription?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practice_sessions_speech_id_fkey"
            columns: ["speech_id"]
            isOneToOne: false
            referencedRelation: "speeches"
            referencedColumns: ["id"]
          },
        ]
      }
      presentation_sessions: {
        Row: {
          accuracy: number | null
          created_at: string | null
          duration_seconds: number | null
          feedback_advice: string | null
          feedback_next_step: string | null
          feedback_summary: string | null
          hesitations: number | null
          id: string
          missed_words: string[] | null
          speech_id: string
          transcript: string | null
        }
        Insert: {
          accuracy?: number | null
          created_at?: string | null
          duration_seconds?: number | null
          feedback_advice?: string | null
          feedback_next_step?: string | null
          feedback_summary?: string | null
          hesitations?: number | null
          id?: string
          missed_words?: string[] | null
          speech_id: string
          transcript?: string | null
        }
        Update: {
          accuracy?: number | null
          created_at?: string | null
          duration_seconds?: number | null
          feedback_advice?: string | null
          feedback_next_step?: string | null
          feedback_summary?: string | null
          hesitations?: number | null
          id?: string
          missed_words?: string[] | null
          speech_id?: string
          transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "presentation_sessions_speech_id_fkey"
            columns: ["speech_id"]
            isOneToOne: false
            referencedRelation: "speeches"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          feedback_language: string | null
          full_name: string | null
          id: string
          monthly_speeches_count: number
          monthly_speeches_reset_date: string
          notifications_enabled: boolean | null
          push_platform: string | null
          push_token: string | null
          skill_level: string | null
          subscription_status: string
          subscription_tier: Database["public"]["Enums"]["subscription_tier"]
        }
        Insert: {
          created_at?: string
          email?: string | null
          feedback_language?: string | null
          full_name?: string | null
          id: string
          monthly_speeches_count?: number
          monthly_speeches_reset_date?: string
          notifications_enabled?: boolean | null
          push_platform?: string | null
          push_token?: string | null
          skill_level?: string | null
          subscription_status?: string
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
        }
        Update: {
          created_at?: string
          email?: string | null
          feedback_language?: string | null
          full_name?: string | null
          id?: string
          monthly_speeches_count?: number
          monthly_speeches_reset_date?: string
          notifications_enabled?: boolean | null
          push_platform?: string | null
          push_token?: string | null
          skill_level?: string | null
          subscription_status?: string
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
        }
        Relationships: []
      }
      schedules: {
        Row: {
          completed: boolean
          created_at: string
          difficulty_level: string | null
          id: string
          interval_days: number | null
          last_reviewed_at: string | null
          mastery_score: number | null
          next_review_date: string | null
          review_count: number | null
          session_date: string
          speech_id: string
          success_rate: number | null
        }
        Insert: {
          completed?: boolean
          created_at?: string
          difficulty_level?: string | null
          id?: string
          interval_days?: number | null
          last_reviewed_at?: string | null
          mastery_score?: number | null
          next_review_date?: string | null
          review_count?: number | null
          session_date: string
          speech_id: string
          success_rate?: number | null
        }
        Update: {
          completed?: boolean
          created_at?: string
          difficulty_level?: string | null
          id?: string
          interval_days?: number | null
          last_reviewed_at?: string | null
          mastery_score?: number | null
          next_review_date?: string | null
          review_count?: number | null
          session_date?: string
          speech_id?: string
          success_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "schedules_speech_id_fkey"
            columns: ["speech_id"]
            isOneToOne: false
            referencedRelation: "speeches"
            referencedColumns: ["id"]
          },
        ]
      }
      speeches: {
        Row: {
          created_at: string
          familiarity_level: string | null
          goal_date: string
          id: string
          mastery_level: number | null
          speech_language: string | null
          text_current: string
          text_original: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          familiarity_level?: string | null
          goal_date: string
          id?: string
          mastery_level?: number | null
          speech_language?: string | null
          text_current: string
          text_original: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          familiarity_level?: string | null
          goal_date?: string
          id?: string
          mastery_level?: number | null
          speech_language?: string | null
          text_current?: string
          text_original?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "speeches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_next_interval:
        | {
            Args: {
              accuracy: number
              current_interval: number
              difficulty_level?: string
            }
            Returns: number
          }
        | {
            Args: { accuracy: number; current_interval: number }
            Returns: number
          }
      calculate_personalized_interval: {
        Args: {
          p_accuracy: number
          p_current_interval: number
          p_days_until_deadline: number
          p_difficulty_level: string
          p_skill_level: string
        }
        Returns: number
      }
      can_create_speech: { Args: { p_user_id: string }; Returns: boolean }
      get_speeches_due_for_review: {
        Args: { p_user_id: string }
        Returns: {
          difficulty_level: string
          interval_days: number
          next_review_date: string
          review_count: number
          speech_id: string
          speech_title: string
          success_rate: number
        }[]
      }
      get_users_with_due_reviews: {
        Args: never
        Returns: {
          due_count: number
          push_platform: string
          push_token: string
          speech_titles: string[]
          user_id: string
        }[]
      }
      get_word_limit: { Args: { p_user_id: string }; Returns: number }
      update_mastery_level: {
        Args: { p_accuracy: number; p_speech_id: string }
        Returns: undefined
      }
      update_personalized_schedule: {
        Args: {
          p_accuracy: number
          p_session_date?: string
          p_speech_id: string
        }
        Returns: undefined
      }
      update_schedule_after_practice: {
        Args: {
          p_accuracy: number
          p_session_date?: string
          p_speech_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      subscription_tier: "free" | "student" | "regular" | "enterprise"
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
      subscription_tier: ["free", "student", "regular", "enterprise"],
    },
  },
} as const
