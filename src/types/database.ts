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
      cleanup_jobs: {
        Row: {
          attempts: number
          created_at: string
          dedupe_key: string
          error_code: string | null
          finished_at: string | null
          id: string
          kind: string
          lease_token: string | null
          locked_until: string | null
          photo_id: string | null
          progress_expires_at: string | null
          progress_token_hash: string | null
          run_after: string
          status: string
          user_id: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          dedupe_key: string
          error_code?: string | null
          finished_at?: string | null
          id?: string
          kind: string
          lease_token?: string | null
          locked_until?: string | null
          photo_id?: string | null
          progress_expires_at?: string | null
          progress_token_hash?: string | null
          run_after?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          dedupe_key?: string
          error_code?: string | null
          finished_at?: string | null
          id?: string
          kind?: string
          lease_token?: string | null
          locked_until?: string | null
          photo_id?: string | null
          progress_expires_at?: string | null
          progress_token_hash?: string | null
          run_after?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cleanup_jobs_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleanup_jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      events: {
        Row: {
          client_event_id: string
          id: string
          name: string
          occurred_at: string
          photo_id: string | null
          trial_id: string | null
          user_id: string
          visit_context: string
        }
        Insert: {
          client_event_id: string
          id?: string
          name: string
          occurred_at?: string
          photo_id?: string | null
          trial_id?: string | null
          user_id: string
          visit_context?: string
        }
        Update: {
          client_event_id?: string
          id?: string
          name?: string
          occurred_at?: string
          photo_id?: string | null
          trial_id?: string | null
          user_id?: string
          visit_context?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_photo_id_user_id_fkey"
            columns: ["photo_id", "user_id"]
            isOneToOne: false
            referencedRelation: "photos"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "events_trial_id_user_id_fkey"
            columns: ["trial_id", "user_id"]
            isOneToOne: false
            referencedRelation: "trials"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      photos: {
        Row: {
          byte_size: number
          client_request_id: string
          created_at: string
          delete_requested_at: string | null
          deleted_at: string | null
          first_note_at: string | null
          first_viewed_at: string | null
          height: number | null
          id: string
          lifecycle: string
          mime_type: string
          note_text: string
          original_key: string
          original_name: string
          preserved_at: string | null
          ready_at: string | null
          thumbnail_key: string | null
          trial_id: string
          updated_at: string
          upload_deadline_at: string
          user_id: string
          validation_token: string | null
          validation_until: string | null
          version: number
          width: number | null
        }
        Insert: {
          byte_size: number
          client_request_id: string
          created_at?: string
          delete_requested_at?: string | null
          deleted_at?: string | null
          first_note_at?: string | null
          first_viewed_at?: string | null
          height?: number | null
          id?: string
          lifecycle?: string
          mime_type: string
          note_text?: string
          original_key: string
          original_name: string
          preserved_at?: string | null
          ready_at?: string | null
          thumbnail_key?: string | null
          trial_id: string
          updated_at?: string
          upload_deadline_at?: string
          user_id: string
          validation_token?: string | null
          validation_until?: string | null
          version?: number
          width?: number | null
        }
        Update: {
          byte_size?: number
          client_request_id?: string
          created_at?: string
          delete_requested_at?: string | null
          deleted_at?: string | null
          first_note_at?: string | null
          first_viewed_at?: string | null
          height?: number | null
          id?: string
          lifecycle?: string
          mime_type?: string
          note_text?: string
          original_key?: string
          original_name?: string
          preserved_at?: string | null
          ready_at?: string | null
          thumbnail_key?: string | null
          trial_id?: string
          updated_at?: string
          upload_deadline_at?: string
          user_id?: string
          validation_token?: string | null
          validation_until?: string | null
          version?: number
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "photos_trial_id_user_id_fkey"
            columns: ["trial_id", "user_id"]
            isOneToOne: false
            referencedRelation: "trials"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "photos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_state: string
          analytics_consent: boolean
          created_at: string
          timezone: string
          user_id: string
        }
        Insert: {
          account_state?: string
          analytics_consent?: boolean
          created_at?: string
          timezone?: string
          user_id: string
        }
        Update: {
          account_state?: string
          analytics_consent?: boolean
          created_at?: string
          timezone?: string
          user_id?: string
        }
        Relationships: []
      }
      trials: {
        Row: {
          created_at: string
          duration_hours: number
          ends_at: string | null
          experiment_version: string
          id: string
          started_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_hours?: number
          ends_at?: string | null
          experiment_version?: string
          id?: string
          started_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          duration_hours?: number
          ends_at?: string | null
          experiment_version?: string
          id?: string
          started_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trials_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      app_policy: { Args: never; Returns: Json }
      claim_cleanup: {
        Args: never
        Returns: {
          attempts: number
          created_at: string
          dedupe_key: string
          error_code: string | null
          finished_at: string | null
          id: string
          kind: string
          lease_token: string | null
          locked_until: string | null
          photo_id: string | null
          progress_expires_at: string | null
          progress_token_hash: string | null
          run_after: string
          status: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "cleanup_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_upload: {
        Args: { p_photo_id: string; p_user_id: string }
        Returns: Json
      }
      complete_upload: {
        Args: {
          p_bytes: number
          p_height: number
          p_mime: string
          p_photo_id: string
          p_token: string
          p_user_id: string
          p_width: number
        }
        Returns: Json
      }
      defer_cleanup: {
        Args: { p_job_id: string; p_lease_token: string }
        Returns: undefined
      }
      ensure_profile: { Args: { p_user_id: string }; Returns: undefined }
      finish_cleanup: {
        Args: {
          p_error_code?: string
          p_job_id: string
          p_lease_token: string
          p_success: boolean
        }
        Returns: undefined
      }
      mark_viewed: {
        Args: { p_photo_id: string; p_user_id: string }
        Returns: undefined
      }
      me_state: { Args: { p_user_id: string }; Returns: Json }
      purge_account_data: { Args: { p_user_id: string }; Returns: undefined }
      queue_photo_delete: {
        Args: { p_kind?: string; p_photo_id: string; p_user_id: string }
        Returns: {
          attempts: number
          created_at: string
          dedupe_key: string
          error_code: string | null
          finished_at: string | null
          id: string
          kind: string
          lease_token: string | null
          locked_until: string | null
          photo_id: string | null
          progress_expires_at: string | null
          progress_token_hash: string | null
          run_after: string
          status: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "cleanup_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_event: {
        Args: {
          p_client_event_id: string
          p_context: string
          p_name: string
          p_photo_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      release_upload: {
        Args: { p_photo_id: string; p_token: string; p_user_id: string }
        Returns: undefined
      }
      request_account_delete: {
        Args: { p_token_hash: string; p_user_id: string }
        Returns: {
          attempts: number
          created_at: string
          dedupe_key: string
          error_code: string | null
          finished_at: string | null
          id: string
          kind: string
          lease_token: string | null
          locked_until: string | null
          photo_id: string | null
          progress_expires_at: string | null
          progress_token_hash: string | null
          run_after: string
          status: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "cleanup_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reserve_uploads: {
        Args: { p_files: Json; p_user_id: string }
        Returns: Json
      }
      save_note: {
        Args: {
          p_expected_version: number
          p_note_stage: string
          p_note_text: string
          p_photo_id: string
          p_request_id: string
          p_user_id: string
        }
        Returns: Json
      }
      set_preferences: {
        Args: { p_consent: boolean; p_timezone: string; p_user_id: string }
        Returns: {
          account_state: string
          analytics_consent: boolean
          created_at: string
          timezone: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      sweep_incomplete: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
