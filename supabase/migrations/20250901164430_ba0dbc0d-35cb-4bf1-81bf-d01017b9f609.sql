-- Add missing foreign key constraints for exam_enrollments table
ALTER TABLE public.exam_enrollments 
ADD CONSTRAINT exam_enrollments_exam_id_fkey 
FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE;

ALTER TABLE public.exam_enrollments 
ADD CONSTRAINT exam_enrollments_student_id_fkey 
FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- Update RLS policy to allow admins to insert enrollments
DROP POLICY IF EXISTS "Admins can manage enrollments" ON public.exam_enrollments;

CREATE POLICY "Admins can manage all enrollments" 
ON public.exam_enrollments 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.admins 
    WHERE user_id = auth.uid()
  )
);

-- Also allow teachers who are admins to manage enrollments
CREATE POLICY "Admin-teachers can manage enrollments" 
ON public.exam_enrollments 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.teachers t
    JOIN public.admins a ON t.user_id = a.user_id
    WHERE t.user_id = auth.uid()
  )
);