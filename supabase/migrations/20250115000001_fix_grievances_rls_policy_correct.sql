-- Fix RLS policies for grievances table to work with profiles table
-- The grievances.student_id references profiles(id), not students(id)

-- Drop the incorrect policies
DROP POLICY IF EXISTS "Students can manage their grievances" ON public.grievances;
DROP POLICY IF EXISTS "Teachers can view and respond to grievances for their papers" ON public.grievances;
DROP POLICY IF EXISTS "Teachers can update grievances for their papers" ON public.grievances;

-- Create correct policy for students that works with profiles table
CREATE POLICY "Students can manage their grievances" ON public.grievances
  FOR ALL USING (
    student_id = (
      SELECT p.id 
      FROM profiles p 
      WHERE p.user_id = auth.uid()
    )
  );

-- Create correct policy for teachers to view grievances
CREATE POLICY "Teachers can view and respond to grievances for their papers" ON public.grievances
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.user_id = auth.uid() AND p.id = grievances.student_id
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

-- Create correct policy for teachers to update grievances
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

