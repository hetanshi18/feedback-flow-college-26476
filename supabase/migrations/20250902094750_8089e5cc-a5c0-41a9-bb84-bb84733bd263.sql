-- Fix the foreign key constraint to point to students table instead of profiles
ALTER TABLE public.exam_enrollments 
DROP CONSTRAINT exam_enrollments_student_id_fkey;

ALTER TABLE public.exam_enrollments 
ADD CONSTRAINT exam_enrollments_student_id_fkey 
FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;