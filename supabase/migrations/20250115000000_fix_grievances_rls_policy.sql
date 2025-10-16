-- Fix RLS policies for grievances table to work with students table instead of profiles
-- The foreign key constraint was changed to reference students(id) but RLS policies still reference profiles

-- Drop the old policy that references profiles
DROP POLICY IF EXISTS "Students can manage their grievances" ON public.grievances;

-- Create new policy that works with students table
CREATE POLICY "Students can manage their grievances" ON public.grievances
  FOR ALL USING (
    student_id = (
      SELECT s.id 
      FROM students s 
      WHERE s.user_id = auth.uid()
    )
  );

-- Update teacher policies to work with the new structure
DROP POLICY IF EXISTS "Teachers can view and respond to grievances for their papers" ON public.grievances;

CREATE POLICY "Teachers can view and respond to grievances for their papers" ON public.grievances
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM students s 
      WHERE s.user_id = auth.uid() AND s.id = grievances.student_id
    ) OR (
      EXISTS (
        SELECT 1 FROM teachers t 
        WHERE t.user_id = auth.uid()
      ) AND
      answer_sheet_id IN (
        SELECT as_table.id FROM public.answer_sheets as_table
        JOIN public.exam_teacher_assignments eta ON as_table.exam_id = eta.exam_id
        JOIN teachers t ON eta.teacher_id = t.id
        WHERE t.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Teachers can update grievances for their papers" ON public.grievances;

CREATE POLICY "Teachers can update grievances for their papers" ON public.grievances
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM teachers t 
      WHERE t.user_id = auth.uid()
    ) AND
    answer_sheet_id IN (
      SELECT as_table.id FROM public.answer_sheets as_table
      JOIN public.exam_teacher_assignments eta ON as_table.exam_id = eta.exam_id
      JOIN teachers t ON eta.teacher_id = t.id
      WHERE t.user_id = auth.uid()
    )
  );

-- Keep the admin policy as is since it doesn't depend on the foreign key structure
