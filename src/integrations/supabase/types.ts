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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      admins: {
        Row: {
          created_at: string
          email: string
          employee_id: string
          id: string
          name: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          employee_id: string
          id?: string
          name: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          employee_id?: string
          id?: string
          name?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      answer_sheet_annotations: {
        Row: {
          annotation_type: string
          answer_sheet_id: string
          color: string | null
          content: string | null
          created_at: string
          created_by: string
          id: string
          page_number: number
          question_id: string | null
          x_position: number
          y_position: number
        }
        Insert: {
          annotation_type: string
          answer_sheet_id: string
          color?: string | null
          content?: string | null
          created_at?: string
          created_by: string
          id?: string
          page_number: number
          question_id?: string | null
          x_position: number
          y_position: number
        }
        Update: {
          annotation_type?: string
          answer_sheet_id?: string
          color?: string | null
          content?: string | null
          created_at?: string
          created_by?: string
          id?: string
          page_number?: number
          question_id?: string | null
          x_position?: number
          y_position?: number
        }
        Relationships: [
          {
            foreignKeyName: "answer_sheet_annotations_answer_sheet_id_fkey"
            columns: ["answer_sheet_id"]
            isOneToOne: false
            referencedRelation: "answer_sheets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_sheet_annotations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_sheet_annotations_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "answer_sheet_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_answer_sheet_annotations_answer_sheet"
            columns: ["answer_sheet_id"]
            isOneToOne: false
            referencedRelation: "answer_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      answer_sheet_questions: {
        Row: {
          answer_sheet_id: string
          comments: string | null
          created_at: string
          graded_at: string | null
          graded_by: string | null
          id: string
          max_marks: number
          obtained_marks: number | null
          question_number: number
          sub_question: string | null
        }
        Insert: {
          answer_sheet_id: string
          comments?: string | null
          created_at?: string
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          max_marks: number
          obtained_marks?: number | null
          question_number: number
          sub_question?: string | null
        }
        Update: {
          answer_sheet_id?: string
          comments?: string | null
          created_at?: string
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          max_marks?: number
          obtained_marks?: number | null
          question_number?: number
          sub_question?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "answer_sheet_questions_answer_sheet_id_fkey"
            columns: ["answer_sheet_id"]
            isOneToOne: false
            referencedRelation: "answer_sheets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_sheet_questions_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_answer_sheet_questions_answer_sheet"
            columns: ["answer_sheet_id"]
            isOneToOne: false
            referencedRelation: "answer_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      answer_sheets: {
        Row: {
          exam_id: string
          file_url: string
          graded_at: string | null
          graded_by: string | null
          grading_status: string
          id: string
          obtained_marks: number | null
          remarks: string | null
          student_id: string
          total_marks: number | null
          upload_date: string
        }
        Insert: {
          exam_id: string
          file_url: string
          graded_at?: string | null
          graded_by?: string | null
          grading_status?: string
          id?: string
          obtained_marks?: number | null
          remarks?: string | null
          student_id: string
          total_marks?: number | null
          upload_date?: string
        }
        Update: {
          exam_id?: string
          file_url?: string
          graded_at?: string | null
          graded_by?: string | null
          grading_status?: string
          id?: string
          obtained_marks?: number | null
          remarks?: string | null
          student_id?: string
          total_marks?: number | null
          upload_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "answer_sheets_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_sheets_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_sheets_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_answer_sheets_student"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      exam_enrollments: {
        Row: {
          enrollment_date: string
          exam_id: string
          id: string
          status: string
          student_id: string
        }
        Insert: {
          enrollment_date?: string
          exam_id: string
          id?: string
          status?: string
          student_id: string
        }
        Update: {
          enrollment_date?: string
          exam_id?: string
          id?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_enrollments_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_exam_enrollments_exam"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_exam_enrollments_student"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_teacher_assignments: {
        Row: {
          assigned_questions: number[]
          created_at: string
          exam_id: string
          id: string
          marks_per_question: Json
          teacher_id: string
        }
        Insert: {
          assigned_questions?: number[]
          created_at?: string
          exam_id: string
          id?: string
          marks_per_question?: Json
          teacher_id: string
        }
        Update: {
          assigned_questions?: number[]
          created_at?: string
          exam_id?: string
          id?: string
          marks_per_question?: Json
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_teacher_assignments_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_teacher_assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_exam_teacher_assignments_teacher"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          created_at: string
          created_by: string
          duration_minutes: number
          exam_date: string
          id: string
          instructions: string | null
          name: string
          question_paper_url: string | null
          question_paper_visible_to_students: boolean | null
          question_paper_visible_to_teachers: boolean | null
          start_time: string
          status: string
          subject_id: string
          total_marks: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          duration_minutes: number
          exam_date: string
          id?: string
          instructions?: string | null
          name: string
          question_paper_url?: string | null
          question_paper_visible_to_students?: boolean | null
          question_paper_visible_to_teachers?: boolean | null
          start_time: string
          status?: string
          subject_id: string
          total_marks?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          duration_minutes?: number
          exam_date?: string
          id?: string
          instructions?: string | null
          name?: string
          question_paper_url?: string | null
          question_paper_visible_to_students?: boolean | null
          question_paper_visible_to_teachers?: boolean | null
          start_time?: string
          status?: string
          subject_id?: string
          total_marks?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exams_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_exams_subject"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      grievances: {
        Row: {
          answer_sheet_id: string
          current_marks: number
          expected_marks: number | null
          grievance_text: string
          id: string
          question_number: number
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          student_id: string
          sub_question: string | null
          submitted_at: string
          teacher_response: string | null
          updated_marks: number | null
        }
        Insert: {
          answer_sheet_id: string
          current_marks: number
          expected_marks?: number | null
          grievance_text: string
          id?: string
          question_number: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_id: string
          sub_question?: string | null
          submitted_at?: string
          teacher_response?: string | null
          updated_marks?: number | null
        }
        Update: {
          answer_sheet_id?: string
          current_marks?: number
          expected_marks?: number | null
          grievance_text?: string
          id?: string
          question_number?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_id?: string
          sub_question?: string | null
          submitted_at?: string
          teacher_response?: string | null
          updated_marks?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_grievances_student"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grievances_answer_sheet_id_fkey"
            columns: ["answer_sheet_id"]
            isOneToOne: false
            referencedRelation: "answer_sheets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grievances_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grievances_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          department: string | null
          email: string
          id: string
          name: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          email: string
          id?: string
          name: string
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string
          id?: string
          name?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      semesters: {
        Row: {
          academic_year: string
          created_at: string
          end_date: string
          id: string
          is_active: boolean
          name: string
          start_date: string
        }
        Insert: {
          academic_year: string
          created_at?: string
          end_date: string
          id?: string
          is_active?: boolean
          name: string
          start_date: string
        }
        Update: {
          academic_year?: string
          created_at?: string
          end_date?: string
          id?: string
          is_active?: boolean
          name?: string
          start_date?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          academic_year: string | null
          created_at: string
          department: string
          email: string
          id: string
          name: string
          semester: string | null
          student_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          academic_year?: string | null
          created_at?: string
          department: string
          email: string
          id?: string
          name: string
          semester?: string | null
          student_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          academic_year?: string | null
          created_at?: string
          department?: string
          email?: string
          id?: string
          name?: string
          semester?: string | null
          student_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subjects: {
        Row: {
          code: string
          created_at: string
          credits: number
          department_id: string
          id: string
          name: string
          semester_id: string
        }
        Insert: {
          code: string
          created_at?: string
          credits?: number
          department_id: string
          id?: string
          name: string
          semester_id: string
        }
        Update: {
          code?: string
          created_at?: string
          credits?: number
          department_id?: string
          id?: string
          name?: string
          semester_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_subjects_department"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_subjects_semester"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subjects_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subjects_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          created_at: string
          department: string
          email: string
          employee_id: string
          id: string
          name: string
          specialization: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department: string
          email: string
          employee_id: string
          id?: string
          name: string
          specialization?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department?: string
          email?: string
          employee_id?: string
          id?: string
          name?: string
          specialization?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_active_semester: {
        Args: Record<PropertyKey, never>
        Returns: {
          academic_year: string
          id: string
          name: string
        }[]
      }
      get_current_user_details: {
        Args: Record<PropertyKey, never>
        Returns: {
          additional_info: Json
          department: string
          email: string
          name: string
          record_id: string
          user_type: string
        }[]
      }
      get_current_user_profile: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_at: string
          department: string | null
          email: string
          id: string
          name: string
          role: string
          updated_at: string
          user_id: string
        }
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_departments: {
        Args: Record<PropertyKey, never>
        Returns: {
          code: string
          id: string
          name: string
        }[]
      }
      get_students_by_department: {
        Args: { dept_name?: string }
        Returns: {
          academic_year: string
          department: string
          email: string
          id: string
          name: string
          semester: string
          student_id: string
        }[]
      }
      get_subjects_by_department: {
        Args: { dept_id?: string }
        Returns: {
          code: string
          credits: number
          department_name: string
          id: string
          name: string
          semester_name: string
        }[]
      }
      get_teachers_by_department: {
        Args: { dept_name?: string }
        Returns: {
          department: string
          email: string
          id: string
          name: string
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
    Enums: {},
  },
} as const
