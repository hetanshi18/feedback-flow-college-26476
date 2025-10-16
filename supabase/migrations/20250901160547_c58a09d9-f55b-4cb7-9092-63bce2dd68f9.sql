-- Clean up data and migrate missing teachers
-- First, let's migrate missing teachers from profiles to teachers table
INSERT INTO public.teachers (user_id, name, email, employee_id, department)
SELECT 
  p.user_id,
  p.name,
  p.email,
  'EMP' || substr(p.user_id::text, 1, 8),
  COALESCE(p.department, 'General')
FROM profiles p
WHERE p.role = 'teacher' 
AND NOT EXISTS (
  SELECT 1 FROM teachers t WHERE t.user_id = p.user_id
);

-- Create a mapping table to update exam_teacher_assignments
-- Update exam_teacher_assignments to use the correct teacher IDs from the teachers table
UPDATE public.exam_teacher_assignments 
SET teacher_id = (
  SELECT t.id 
  FROM teachers t
  JOIN profiles p ON t.user_id = p.user_id
  WHERE p.id = exam_teacher_assignments.teacher_id
)
WHERE EXISTS (
  SELECT 1 
  FROM profiles p
  JOIN teachers t ON p.user_id = t.user_id
  WHERE p.id = exam_teacher_assignments.teacher_id
);

-- Delete any exam_teacher_assignments that still can't be mapped
DELETE FROM public.exam_teacher_assignments
WHERE teacher_id NOT IN (SELECT id FROM teachers);