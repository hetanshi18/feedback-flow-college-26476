-- Let's completely clean up the exam_teacher_assignments table and rebuild it properly
-- First, let's see what we have and clean it up step by step

-- Step 1: Remove all existing constraints
ALTER TABLE public.exam_teacher_assignments DROP CONSTRAINT IF EXISTS exam_teacher_assignments_teacher_id_fkey;
ALTER TABLE public.exam_teacher_assignments DROP CONSTRAINT IF EXISTS exam_teacher_assignments_exam_id_fkey;

-- Step 2: Delete all existing records that reference invalid teachers
DELETE FROM public.exam_teacher_assignments;

-- Step 3: Migrate all teachers from profiles to teachers table if they don't exist
INSERT INTO public.teachers (user_id, name, email, employee_id, department)
SELECT DISTINCT
  p.user_id,
  p.name,
  p.email,
  'EMP' || substr(p.user_id::text, 1, 8),
  COALESCE(p.department, 'General')
FROM profiles p
WHERE p.role = 'teacher' 
AND NOT EXISTS (
  SELECT 1 FROM teachers t WHERE t.user_id = p.user_id
)
ON CONFLICT DO NOTHING;

-- Step 4: Add the foreign key constraints back
ALTER TABLE public.exam_teacher_assignments  
ADD CONSTRAINT exam_teacher_assignments_teacher_id_fkey 
FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE CASCADE;

ALTER TABLE public.exam_teacher_assignments
ADD CONSTRAINT exam_teacher_assignments_exam_id_fkey
FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE;