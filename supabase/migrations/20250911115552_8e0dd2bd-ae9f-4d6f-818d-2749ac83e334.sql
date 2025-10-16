-- Remove duplicate foreign key constraints that are causing PostgREST embedding issues

-- Drop the duplicate foreign keys we added earlier
ALTER TABLE answer_sheets DROP CONSTRAINT IF EXISTS fk_answer_sheets_exam;
ALTER TABLE grievances DROP CONSTRAINT IF EXISTS fk_grievances_answer_sheet;

-- Check and fix RLS policies for exam_teacher_assignments to use specific permissions
DROP POLICY IF EXISTS "Teachers can view their assignments" ON exam_teacher_assignments;

CREATE POLICY "Teachers can view their assignments" 
ON exam_teacher_assignments 
FOR SELECT 
USING (teacher_id = (
  SELECT t.id 
  FROM teachers t 
  WHERE t.user_id = auth.uid()
));

-- Update answer_sheets policies to be more specific
DROP POLICY IF EXISTS "Teachers can view assigned answer sheets" ON answer_sheets;

CREATE POLICY "Teachers can view assigned answer sheets" 
ON answer_sheets 
FOR SELECT 
USING (exam_id IN (
  SELECT eta.exam_id 
  FROM exam_teacher_assignments eta 
  JOIN teachers t ON eta.teacher_id = t.id 
  WHERE t.user_id = auth.uid()
));

DROP POLICY IF EXISTS "Teachers can update assigned answer sheets" ON answer_sheets;

CREATE POLICY "Teachers can update assigned answer sheets" 
ON answer_sheets 
FOR UPDATE 
USING (exam_id IN (
  SELECT eta.exam_id 
  FROM exam_teacher_assignments eta 
  JOIN teachers t ON eta.teacher_id = t.id 
  WHERE t.user_id = auth.uid()
));