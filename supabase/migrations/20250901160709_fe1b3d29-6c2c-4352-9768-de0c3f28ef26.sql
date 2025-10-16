-- Fix RLS security issues

-- Enable RLS on all tables that need it
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answer_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answer_sheet_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answer_sheet_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grievances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semesters ENABLE ROW LEVEL SECURITY;

-- Fix RLS policies to prevent infinite recursion by updating get_current_user_role function
-- Update the function to use the new table structure
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE 
      WHEN EXISTS (SELECT 1 FROM public.students WHERE user_id = auth.uid()) THEN 'student'
      WHEN EXISTS (SELECT 1 FROM public.teachers WHERE user_id = auth.uid()) THEN 'teacher'
      WHEN EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()) THEN 'admin'
      ELSE 'unknown'
    END;
$$;