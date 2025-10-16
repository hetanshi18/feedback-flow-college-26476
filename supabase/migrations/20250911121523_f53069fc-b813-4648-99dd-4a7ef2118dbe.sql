-- Fix duplicate foreign key relationship causing PGRST201 error
-- The error shows two foreign keys exist: exam_teacher_assignments_exam_id_fkey and fk_exam_teacher_assignments_exam

-- Drop the manually created foreign key constraint to leave only the default one
ALTER TABLE exam_teacher_assignments DROP CONSTRAINT IF EXISTS fk_exam_teacher_assignments_exam;

-- Ensure we have proper indexing for performance
CREATE INDEX IF NOT EXISTS idx_exam_teacher_assignments_exam_id ON exam_teacher_assignments(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_teacher_assignments_teacher_id ON exam_teacher_assignments(teacher_id);