-- Fix foreign key constraints and RLS policies

-- First, let's add proper foreign key constraints to exam_teacher_assignments
ALTER TABLE public.exam_teacher_assignments
DROP CONSTRAINT IF EXISTS exam_teacher_assignments_teacher_id_fkey;

ALTER TABLE public.exam_teacher_assignments  
ADD CONSTRAINT exam_teacher_assignments_teacher_id_fkey 
FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE CASCADE;

-- Add foreign key for exam_id as well
ALTER TABLE public.exam_teacher_assignments
DROP CONSTRAINT IF EXISTS exam_teacher_assignments_exam_id_fkey;

ALTER TABLE public.exam_teacher_assignments
ADD CONSTRAINT exam_teacher_assignments_exam_id_fkey
FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE;

-- Fix RLS policies for teachers table to prevent infinite recursion
DROP POLICY IF EXISTS "Teachers can view other teachers" ON public.teachers;
DROP POLICY IF EXISTS "Teachers can view their own record" ON public.teachers;

-- Create non-recursive RLS policies for teachers
CREATE POLICY "Teachers can view all teachers"
ON public.teachers
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Teachers can update own record"
ON public.teachers
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Fix RLS policies for students table
DROP POLICY IF EXISTS "Students can view their own record" ON public.students;
DROP POLICY IF EXISTS "Teachers can view students" ON public.students;

CREATE POLICY "Students can view own record"
ON public.students
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Teachers and admins can view students"
ON public.students
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.teachers WHERE user_id = auth.uid()
  ) OR 
  EXISTS (
    SELECT 1 FROM public.admins WHERE user_id = auth.uid()
  )
);

-- Fix RLS policies for admins table
DROP POLICY IF EXISTS "Admins can view their own record" ON public.admins;

CREATE POLICY "Admins can view own record"
ON public.admins
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Add missing foreign keys for answer_sheets
ALTER TABLE public.answer_sheets
DROP CONSTRAINT IF EXISTS answer_sheets_exam_id_fkey;

ALTER TABLE public.answer_sheets
ADD CONSTRAINT answer_sheets_exam_id_fkey
FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE;

ALTER TABLE public.answer_sheets
DROP CONSTRAINT IF EXISTS answer_sheets_student_id_fkey;

ALTER TABLE public.answer_sheets
ADD CONSTRAINT answer_sheets_student_id_fkey
FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

ALTER TABLE public.answer_sheets
DROP CONSTRAINT IF EXISTS answer_sheets_graded_by_fkey;

ALTER TABLE public.answer_sheets
ADD CONSTRAINT answer_sheets_graded_by_fkey
FOREIGN KEY (graded_by) REFERENCES public.teachers(id);

-- Add missing foreign keys for exams
ALTER TABLE public.exams
DROP CONSTRAINT IF EXISTS exams_subject_id_fkey;

ALTER TABLE public.exams
ADD CONSTRAINT exams_subject_id_fkey
FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;

ALTER TABLE public.exams
DROP CONSTRAINT IF EXISTS exams_created_by_fkey;

ALTER TABLE public.exams
ADD CONSTRAINT exams_created_by_fkey
FOREIGN KEY (created_by) REFERENCES public.admins(id);

-- Add missing foreign keys for subjects
ALTER TABLE public.subjects
DROP CONSTRAINT IF EXISTS subjects_department_id_fkey;

ALTER TABLE public.subjects
ADD CONSTRAINT subjects_department_id_fkey
FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;

ALTER TABLE public.subjects
DROP CONSTRAINT IF EXISTS subjects_semester_id_fkey;

ALTER TABLE public.subjects
ADD CONSTRAINT subjects_semester_id_fkey
FOREIGN KEY (semester_id) REFERENCES public.semesters(id) ON DELETE CASCADE;

-- Add missing foreign keys for exam_enrollments
ALTER TABLE public.exam_enrollments
DROP CONSTRAINT IF EXISTS exam_enrollments_exam_id_fkey;

ALTER TABLE public.exam_enrollments
ADD CONSTRAINT exam_enrollments_exam_id_fkey
FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE;

ALTER TABLE public.exam_enrollments
DROP CONSTRAINT IF EXISTS exam_enrollments_student_id_fkey;

ALTER TABLE public.exam_enrollments
ADD CONSTRAINT exam_enrollments_student_id_fkey
FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;