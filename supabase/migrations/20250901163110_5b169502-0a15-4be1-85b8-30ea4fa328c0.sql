-- Fix the get_current_user_details function to prioritize teacher role over admin
CREATE OR REPLACE FUNCTION public.get_current_user_details()
RETURNS TABLE(user_type text, record_id uuid, name text, email text, department text, additional_info jsonb)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE 
      -- Prioritize teacher role if user has both admin and teacher records
      WHEN t.id IS NOT NULL THEN 'teacher'
      WHEN a.id IS NOT NULL THEN 'admin'
      WHEN s.id IS NOT NULL THEN 'student'
      ELSE 'unknown'
    END as user_type,
    CASE 
      WHEN t.id IS NOT NULL THEN t.id
      WHEN a.id IS NOT NULL THEN a.id
      WHEN s.id IS NOT NULL THEN s.id
      ELSE NULL
    END as record_id,
    COALESCE(t.name, a.name, s.name) as name,
    COALESCE(t.email, a.email, s.email) as email,
    COALESCE(t.department, 'Administration', s.department) as department,
    CASE 
      WHEN t.id IS NOT NULL THEN jsonb_build_object('employee_id', t.employee_id, 'specialization', t.specialization)
      WHEN a.id IS NOT NULL THEN jsonb_build_object('employee_id', a.employee_id, 'role', a.role)
      WHEN s.id IS NOT NULL THEN jsonb_build_object('student_id', s.student_id, 'semester', s.semester, 'academic_year', s.academic_year)
      ELSE '{}'::jsonb
    END as additional_info
  FROM (SELECT auth.uid() as uid) auth_user
  LEFT JOIN teachers t ON t.user_id = auth_user.uid
  LEFT JOIN admins a ON a.user_id = auth_user.uid
  LEFT JOIN students s ON s.user_id = auth_user.uid
  LIMIT 1;
$$;