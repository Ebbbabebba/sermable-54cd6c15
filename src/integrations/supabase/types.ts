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
      beat_progress: {
        Row: {
          beat_id: string
          current_phase: string | null
          failed_word_indices: Json | null
          id: string
          repetition_count: number | null
          updated_at: string | null
          user_id: string
          visible_word_indices: Json | null
        }
        Insert: {
          beat_id: string
          current_phase?: string | null
          failed_word_indices?: Json | null
          id?: string
          repetition_count?: number | null
          updated_at?: string | null
          user_id: string
          visible_word_indices?: Json | null
        }
        Update: {
          beat_id?: string
          current_phase?: string | null
          failed_word_indices?: Json | null
          id?: string
          repetition_count?: number | null
          updated_at?: string | null
          user_id?: string
          visible_word_indices?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "beat_progress_beat_id_fkey"
            columns: ["beat_id"]
            isOneToOne: false
            referencedRelation: "practice_beats"
            referencedColumns: ["id"]
          },
        ]
      }
      freestyle_keywords: {
        Row: {
          created_at: string | null
          display_order: number
          id: string
          importance: string
          keyword: string
          keyword_type: string | null
          speech_id: string
          topic: string
          topic_id: string | null
        }
        Insert: {
          created_at?: string | null
          display_order: number
          id?: string
          importance?: string
          keyword: string
          keyword_type?: string | null
          speech_id: string
          topic: string
          topic_id?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number
          id?: string
          importance?: string
          keyword?: string
          keyword_type?: string | null
          speech_id?: string
          topic?: string
          topic_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "freestyle_keywords_speech_id_fkey"
            columns: ["speech_id"]
            isOneToOne: false
            referencedRelation: "speeches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freestyle_keywords_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "freestyle_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      freestyle_segments: {
        Row: {
          content: string
          created_at: string | null
          cue_words: string[]
          id: string
          importance_level: string
          segment_order: number
          speech_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          cue_words?: string[]
          id?: string
          importance_level: string
          segment_order: number
          speech_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          cue_words?: string[]
          id?: string
          importance_level?: string
          segment_order?: number
          speech_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "freestyle_segments_speech_id_fkey"
            columns: ["speech_id"]
            isOneToOne: false
            referencedRelation: "speeches"
            referencedColumns: ["id"]
          },
        ]
      }
      freestyle_sessions: {
        Row: {
          completed_at: string | null
          covered_segments: number[] | null
          created_at: string | null
          duration_seconds: number | null
          id: string
          improvisation_count: number | null
          mentioned_cue_words: string[] | null
          missed_cue_words: string[] | null
          pause_count: number | null
          speech_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          covered_segments?: number[] | null
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          improvisation_count?: number | null
          mentioned_cue_words?: string[] | null
          missed_cue_words?: string[] | null
          pause_count?: number | null
          speech_id: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          covered_segments?: number[] | null
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          improvisation_count?: number | null
          mentioned_cue_words?: string[] | null
          missed_cue_words?: string[] | null
          pause_count?: number | null
          speech_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "freestyle_sessions_speech_id_fkey"
            columns: ["speech_id"]
            isOneToOne: false
            referencedRelation: "speeches"
            referencedColumns: ["id"]
          },
        ]
      }
      freestyle_topics: {
        Row: {
          created_at: string | null
          id: string
          original_text: string | null
          speech_id: string
          summary_hint: string | null
          topic_name: string
          topic_order: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          original_text?: string | null
          speech_id: string
          summary_hint?: string | null
          topic_name: string
          topic_order: number
        }
        Update: {
          created_at?: string | null
          id?: string
          original_text?: string | null
          speech_id?: string
          summary_hint?: string | null
          topic_name?: string
          topic_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "freestyle_topics_speech_id_fkey"
            columns: ["speech_id"]
            isOneToOne: false
            referencedRelation: "speeches"
            referencedColumns: ["id"]
          },
        ]
      }
      mastered_words: {
        Row: {
          consecutive_sessions_correct: number | null
          created_at: string
          hesitated_count: number | null
          hidden_hesitate_count: number | null
          hidden_miss_count: number | null
          id: string
          is_anchor_keyword: boolean | null
          last_spoken_at: string
          missed_count: number | null
          speech_id: string
          times_spoken_correctly: number
          word: string
        }
        Insert: {
          consecutive_sessions_correct?: number | null
          created_at?: string
          hesitated_count?: number | null
          hidden_hesitate_count?: number | null
          hidden_miss_count?: number | null
          id?: string
          is_anchor_keyword?: boolean | null
          last_spoken_at?: string
          missed_count?: number | null
          speech_id: string
          times_spoken_correctly?: number
          word: string
        }
        Update: {
          consecutive_sessions_correct?: number | null
          created_at?: string
          hesitated_count?: number | null
          hidden_hesitate_count?: number | null
          hidden_miss_count?: number | null
          id?: string
          is_anchor_keyword?: boolean | null
          last_spoken_at?: string
          missed_count?: number | null
          speech_id?: string
          times_spoken_correctly?: number
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "mastered_words_speech_id_fkey"
            columns: ["speech_id"]
            isOneToOne: false
            referencedRelation: "speeches"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_beats: {
        Row: {
          beat_order: number
          checkpoint_hidden_indices: Json | null
          checkpoint_phase: string | null
          checkpoint_sentence: number | null
          consecutive_perfect_recalls: number | null
          created_at: string | null
          id: string
          is_mastered: boolean | null
          last_recall_at: string | null
          mastered_at: string | null
          practice_stage: string | null
          sentence_1_text: string
          sentence_2_text: string
          sentence_3_text: string
          speech_id: string
          stage_started_at: string | null
          words_hidden_per_round: number | null
        }
        Insert: {
          beat_order: number
          checkpoint_hidden_indices?: Json | null
          checkpoint_phase?: string | null
          checkpoint_sentence?: number | null
          consecutive_perfect_recalls?: number | null
          created_at?: string | null
          id?: string
          is_mastered?: boolean | null
          last_recall_at?: string | null
          mastered_at?: string | null
          practice_stage?: string | null
          sentence_1_text: string
          sentence_2_text: string
          sentence_3_text: string
          speech_id: string
          stage_started_at?: string | null
          words_hidden_per_round?: number | null
        }
        Update: {
          beat_order?: number
          checkpoint_hidden_indices?: Json | null
          checkpoint_phase?: string | null
          checkpoint_sentence?: number | null
          consecutive_perfect_recalls?: number | null
          created_at?: string | null
          id?: string
          is_mastered?: boolean | null
          last_recall_at?: string | null
          mastered_at?: string | null
          practice_stage?: string | null
          sentence_1_text?: string
          sentence_2_text?: string
          sentence_3_text?: string
          speech_id?: string
          stage_started_at?: string | null
          words_hidden_per_round?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "practice_beats_speech_id_fkey"
            columns: ["speech_id"]
            isOneToOne: false
            referencedRelation: "speeches"
            referencedColumns: ["id"]
          },
        ]
      }
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
          user_rating: string | null
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
          user_rating?: string | null
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
          user_rating?: string | null
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
          avg_time_per_word_ms: number | null
          created_at: string | null
          duration_seconds: number | null
          feedback_advice: string | null
          feedback_next_step: string | null
          feedback_summary: string | null
          fluency_timeline: Json | null
          hesitations: number | null
          id: string
          longest_pause_ms: number | null
          missed_words: string[] | null
          mode: string | null
          pace_consistency: number | null
          speech_id: string
          transcript: string | null
          user_id: string | null
          word_performance_json: Json | null
        }
        Insert: {
          accuracy?: number | null
          avg_time_per_word_ms?: number | null
          created_at?: string | null
          duration_seconds?: number | null
          feedback_advice?: string | null
          feedback_next_step?: string | null
          feedback_summary?: string | null
          fluency_timeline?: Json | null
          hesitations?: number | null
          id?: string
          longest_pause_ms?: number | null
          missed_words?: string[] | null
          mode?: string | null
          pace_consistency?: number | null
          speech_id: string
          transcript?: string | null
          user_id?: string | null
          word_performance_json?: Json | null
        }
        Update: {
          accuracy?: number | null
          avg_time_per_word_ms?: number | null
          created_at?: string | null
          duration_seconds?: number | null
          feedback_advice?: string | null
          feedback_next_step?: string | null
          feedback_summary?: string | null
          fluency_timeline?: Json | null
          hesitations?: number | null
          id?: string
          longest_pause_ms?: number | null
          missed_words?: string[] | null
          mode?: string | null
          pace_consistency?: number | null
          speech_id?: string
          transcript?: string | null
          user_id?: string | null
          word_performance_json?: Json | null
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
      presentation_word_performance: {
        Row: {
          created_at: string | null
          id: string
          session_id: string
          speech_id: string
          status: string
          time_to_speak_ms: number | null
          was_prompted: boolean | null
          word: string
          word_index: number
          wrong_attempts: string[] | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          session_id: string
          speech_id: string
          status?: string
          time_to_speak_ms?: number | null
          was_prompted?: boolean | null
          word: string
          word_index: number
          wrong_attempts?: string[] | null
        }
        Update: {
          created_at?: string | null
          id?: string
          session_id?: string
          speech_id?: string
          status?: string
          time_to_speak_ms?: number | null
          was_prompted?: boolean | null
          word?: string
          word_index?: number
          wrong_attempts?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "presentation_word_performance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "presentation_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presentation_word_performance_speech_id_fkey"
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
          practice_end_hour: number | null
          practice_start_hour: number | null
          push_platform: string | null
          push_token: string | null
          skill_level: string | null
          subscription_status: string
          subscription_tier: Database["public"]["Enums"]["subscription_tier"]
          timezone: string | null
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
          practice_end_hour?: number | null
          practice_start_hour?: number | null
          push_platform?: string | null
          push_token?: string | null
          skill_level?: string | null
          subscription_status?: string
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          timezone?: string | null
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
          practice_end_hour?: number | null
          practice_start_hour?: number | null
          push_platform?: string | null
          push_token?: string | null
          skill_level?: string | null
          subscription_status?: string
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          timezone?: string | null
        }
        Relationships: []
      }
      schedules: {
        Row: {
          adaptive_frequency_multiplier: number | null
          card_state: string | null
          completed: boolean
          created_at: string
          days_until_deadline: number | null
          difficulty_level: string | null
          ease_factor: number | null
          id: string
          interval_days: number | null
          last_reviewed_at: string | null
          learning_step: number | null
          mastery_score: number | null
          next_review_date: string | null
          review_count: number | null
          session_date: string
          speech_id: string
          success_rate: number | null
        }
        Insert: {
          adaptive_frequency_multiplier?: number | null
          card_state?: string | null
          completed?: boolean
          created_at?: string
          days_until_deadline?: number | null
          difficulty_level?: string | null
          ease_factor?: number | null
          id?: string
          interval_days?: number | null
          last_reviewed_at?: string | null
          learning_step?: number | null
          mastery_score?: number | null
          next_review_date?: string | null
          review_count?: number | null
          session_date: string
          speech_id: string
          success_rate?: number | null
        }
        Update: {
          adaptive_frequency_multiplier?: number | null
          card_state?: string | null
          completed?: boolean
          created_at?: string
          days_until_deadline?: number | null
          difficulty_level?: string | null
          ease_factor?: number | null
          id?: string
          interval_days?: number | null
          last_reviewed_at?: string | null
          learning_step?: number | null
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
      speech_phrases: {
        Row: {
          created_at: string | null
          end_word_index: number
          id: string
          is_hidden: boolean | null
          phrase_text: string
          segment_id: string | null
          speech_id: string
          start_word_index: number
          times_correct: number | null
          times_missed: number | null
        }
        Insert: {
          created_at?: string | null
          end_word_index: number
          id?: string
          is_hidden?: boolean | null
          phrase_text: string
          segment_id?: string | null
          speech_id: string
          start_word_index: number
          times_correct?: number | null
          times_missed?: number | null
        }
        Update: {
          created_at?: string | null
          end_word_index?: number
          id?: string
          is_hidden?: boolean | null
          phrase_text?: string
          segment_id?: string | null
          speech_id?: string
          start_word_index?: number
          times_correct?: number | null
          times_missed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "speech_phrases_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "speech_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "speech_phrases_speech_id_fkey"
            columns: ["speech_id"]
            isOneToOne: false
            referencedRelation: "speeches"
            referencedColumns: ["id"]
          },
        ]
      }
      speech_segments: {
        Row: {
          anchor_keywords: number[] | null
          average_accuracy: number | null
          created_at: string
          end_word_index: number
          id: string
          is_mastered: boolean
          last_practiced_at: string | null
          merged_with_next: boolean
          next_review_at: string | null
          segment_order: number
          segment_text: string
          speech_id: string
          start_word_index: number
          times_practiced: number
          visibility_percent: number | null
        }
        Insert: {
          anchor_keywords?: number[] | null
          average_accuracy?: number | null
          created_at?: string
          end_word_index: number
          id?: string
          is_mastered?: boolean
          last_practiced_at?: string | null
          merged_with_next?: boolean
          next_review_at?: string | null
          segment_order: number
          segment_text: string
          speech_id: string
          start_word_index: number
          times_practiced?: number
          visibility_percent?: number | null
        }
        Update: {
          anchor_keywords?: number[] | null
          average_accuracy?: number | null
          created_at?: string
          end_word_index?: number
          id?: string
          is_mastered?: boolean
          last_practiced_at?: string | null
          merged_with_next?: boolean
          next_review_at?: string | null
          segment_order?: number
          segment_text?: string
          speech_id?: string
          start_word_index?: number
          times_practiced?: number
          visibility_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "speech_segments_speech_id_fkey"
            columns: ["speech_id"]
            isOneToOne: false
            referencedRelation: "speeches"
            referencedColumns: ["id"]
          },
        ]
      }
      speeches: {
        Row: {
          base_word_visibility_percent: number | null
          consecutive_struggles: number | null
          created_at: string
          current_segment_length: number | null
          ease_factor: number | null
          familiarity_level: string | null
          goal_date: string | null
          id: string
          last_accuracy: number | null
          last_practice_session_at: string | null
          learning_mode: string | null
          mastery_level: number | null
          next_review_date: string | null
          performance_trend: number | null
          practice_segment_end: number | null
          practice_segment_start: number | null
          presentation_mode: string | null
          review_interval: number | null
          speech_language: string | null
          speech_type: string | null
          target_segment_length: number | null
          text_current: string
          text_original: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          base_word_visibility_percent?: number | null
          consecutive_struggles?: number | null
          created_at?: string
          current_segment_length?: number | null
          ease_factor?: number | null
          familiarity_level?: string | null
          goal_date?: string | null
          id?: string
          last_accuracy?: number | null
          last_practice_session_at?: string | null
          learning_mode?: string | null
          mastery_level?: number | null
          next_review_date?: string | null
          performance_trend?: number | null
          practice_segment_end?: number | null
          practice_segment_start?: number | null
          presentation_mode?: string | null
          review_interval?: number | null
          speech_language?: string | null
          speech_type?: string | null
          target_segment_length?: number | null
          text_current: string
          text_original: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          base_word_visibility_percent?: number | null
          consecutive_struggles?: number | null
          created_at?: string
          current_segment_length?: number | null
          ease_factor?: number | null
          familiarity_level?: string | null
          goal_date?: string | null
          id?: string
          last_accuracy?: number | null
          last_practice_session_at?: string | null
          learning_mode?: string | null
          mastery_level?: number | null
          next_review_date?: string | null
          performance_trend?: number | null
          practice_segment_end?: number | null
          practice_segment_start?: number | null
          presentation_mode?: string | null
          review_interval?: number | null
          speech_language?: string | null
          speech_type?: string | null
          target_segment_length?: number | null
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
      user_learning_analytics: {
        Row: {
          avg_hesitation_rate: number | null
          avg_response_delay_ms: number | null
          avg_words_per_minute: number | null
          avg_words_retained_per_session: number | null
          created_at: string | null
          id: string
          optimal_review_interval_minutes: number | null
          optimal_segment_length: number | null
          overall_mastery_velocity: number | null
          practice_hour_performance: Json | null
          preferred_practice_hours: number[] | null
          preferred_visibility_reduction_rate: number | null
          retention_decay_rate: number | null
          struggle_recovery_sessions: number | null
          total_sessions_completed: number | null
          total_words_practiced: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avg_hesitation_rate?: number | null
          avg_response_delay_ms?: number | null
          avg_words_per_minute?: number | null
          avg_words_retained_per_session?: number | null
          created_at?: string | null
          id?: string
          optimal_review_interval_minutes?: number | null
          optimal_segment_length?: number | null
          overall_mastery_velocity?: number | null
          practice_hour_performance?: Json | null
          preferred_practice_hours?: number[] | null
          preferred_visibility_reduction_rate?: number | null
          retention_decay_rate?: number | null
          struggle_recovery_sessions?: number | null
          total_sessions_completed?: number | null
          total_words_practiced?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avg_hesitation_rate?: number | null
          avg_response_delay_ms?: number | null
          avg_words_per_minute?: number | null
          avg_words_retained_per_session?: number | null
          created_at?: string | null
          id?: string
          optimal_review_interval_minutes?: number | null
          optimal_segment_length?: number | null
          overall_mastery_velocity?: number | null
          practice_hour_performance?: Json | null
          preferred_practice_hours?: number[] | null
          preferred_visibility_reduction_rate?: number | null
          retention_decay_rate?: number | null
          struggle_recovery_sessions?: number | null
          total_sessions_completed?: number | null
          total_words_practiced?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_word_mastery: {
        Row: {
          created_at: string | null
          id: string
          last_seen_at: string | null
          mastery_level: number | null
          total_correct: number | null
          total_hesitated: number | null
          total_missed: number | null
          user_id: string
          word: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_seen_at?: string | null
          mastery_level?: number | null
          total_correct?: number | null
          total_hesitated?: number | null
          total_missed?: number | null
          user_id: string
          word: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_seen_at?: string | null
          mastery_level?: number | null
          total_correct?: number | null
          total_hesitated?: number | null
          total_missed?: number | null
          user_id?: string
          word?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assess_memorization_feasibility: {
        Args: { p_speech_id: string }
        Returns: {
          estimated_days_needed: number
          feasible: boolean
          message: string
          recommended_daily_sessions: number
          warning_level: string
        }[]
      }
      calculate_next_interval:
        | {
            Args: { accuracy: number; current_interval: number }
            Returns: number
          }
        | {
            Args: {
              accuracy: number
              current_interval: number
              difficulty_level?: string
            }
            Returns: number
          }
      calculate_next_review:
        | {
            Args: {
              current_ease: number
              current_interval: number
              performance_quality: number
            }
            Returns: {
              new_ease: number
              new_interval: number
            }[]
          }
        | {
            Args: {
              current_ease: number
              current_interval: number
              performance_quality: number
            }
            Returns: {
              new_ease: number
              new_interval: number
            }[]
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
      calculate_practice_frequency:
        | {
            Args: {
              p_consecutive_struggles: number
              p_days_until_deadline: number
              p_last_accuracy: number
              p_performance_trend: number
            }
            Returns: number
          }
        | {
            Args: {
              p_consecutive_struggles: number
              p_days_until_deadline: number
              p_last_accuracy: number
              p_performance_trend: number
              p_word_count?: number
            }
            Returns: number
          }
        | {
            Args: {
              p_consecutive_struggles: number
              p_days_until_deadline: number
              p_last_accuracy: number
              p_performance_trend: number
              p_word_count?: number
              p_word_visibility?: number
            }
            Returns: number
          }
        | {
            Args: {
              p_consecutive_struggles: number
              p_days_until_deadline: number
              p_last_accuracy: number
              p_performance_trend: number
            }
            Returns: number
          }
        | {
            Args: {
              p_consecutive_struggles: number
              p_days_until_deadline: number
              p_last_accuracy: number
              p_performance_trend: number
              p_word_count?: number
            }
            Returns: number
          }
        | {
            Args: {
              p_consecutive_struggles: number
              p_days_until_deadline: number
              p_last_accuracy: number
              p_performance_trend: number
              p_word_count?: number
              p_word_visibility?: number
            }
            Returns: number
          }
      calculate_segment_length:
        | {
            Args: {
              p_consecutive_struggles: number
              p_current_segment_length: number
              p_days_until_deadline: number
              p_weighted_accuracy: number
            }
            Returns: number
          }
        | {
            Args: {
              p_consecutive_struggles: number
              p_current_segment_length: number
              p_days_until_deadline: number
              p_weighted_accuracy: number
            }
            Returns: number
          }
      calculate_sm2_interval:
        | {
            Args: {
              p_card_state: string
              p_current_interval: number
              p_ease_factor: number
              p_learning_step: number
              p_user_rating: string
            }
            Returns: {
              new_card_state: string
              new_ease_factor: number
              new_interval: number
              new_learning_step: number
            }[]
          }
        | {
            Args: {
              p_card_state: string
              p_current_interval: number
              p_ease_factor: number
              p_learning_step: number
              p_user_rating: string
            }
            Returns: {
              new_card_state: string
              new_ease_factor: number
              new_interval: number
              new_learning_step: number
            }[]
          }
      calculate_word_visibility:
        | {
            Args: {
              p_consecutive_struggles: number
              p_goal_date: string
              p_performance_trend: number
              p_speech_id: string
              p_weighted_accuracy?: number
            }
            Returns: number
          }
        | {
            Args: {
              p_consecutive_struggles: number
              p_goal_date: string
              p_performance_trend: number
              p_speech_id: string
              p_weighted_accuracy?: number
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
      update_sm2_schedule: {
        Args: {
          p_session_date?: string
          p_speech_id: string
          p_user_rating: string
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
