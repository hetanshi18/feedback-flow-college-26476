-- Enable RLS on exam_teacher_assignments if not already enabled and fix policies
ALTER TABLE public.exam_teacher_assignments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies and recreate simple ones
DROP POLICY IF EXISTS "Admins can manage assignments" ON public.exam_teacher_assignments;
DROP POLICY IF EXISTS "Admins can view all assignments" ON public.exam_teacher_assignments;  
DROP POLICY IF EXISTS "Teachers can view their assignments" ON public.exam_teacher_assignments;

-- Create simple, working policies
CREATE POLICY "Teachers can view their assignments" 
ON public.exam_teacher_assignments 
FOR SELECT 
TO authenticated
USING (
  teacher_id IN (
    SELECT id FROM public.teachers WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage all assignments" 
ON public.exam_teacher_assignments 
FOR ALL 
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
);

-- Also make sure exams table allows teachers to see assigned exams
DROP POLICY IF EXISTS "Admins can manage exams" ON public.exams;
DROP POLICY IF EXISTS "Anyone can view exams" ON public.exams;

CREATE POLICY "All authenticated users can view exams" 
ON public.exams 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Admins can manage exams" 
ON public.exams 
FOR ALL 
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
);