-- Update database functions to use separate tables
CREATE OR REPLACE FUNCTION public.get_teachers_by_department(dept_name text DEFAULT NULL::text)
RETURNS TABLE(id uuid, name text, email text, department text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT t.id, t.name, t.email, t.department
  FROM teachers t 
  WHERE (dept_name IS NULL OR t.department = dept_name)
  ORDER BY t.name;
$function$;

-- Function to get students by department
CREATE OR REPLACE FUNCTION public.get_students_by_department(dept_name text DEFAULT NULL::text)
RETURNS TABLE(id uuid, student_id text, name text, email text, department text, semester text, academic_year text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT s.id, s.student_id, s.name, s.email, s.department, s.semester, s.academic_year
  FROM students s 
  WHERE (dept_name IS NULL OR s.department = dept_name)
  ORDER BY s.name;
$function$;

-- Function to get current user's specific record
CREATE OR REPLACE FUNCTION public.get_current_user_details()
RETURNS TABLE(
  user_type text,
  record_id uuid,
  name text,
  email text,
  department text,
  additional_info jsonb
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 
    CASE 
      WHEN s.id IS NOT NULL THEN 'student'
      WHEN t.id IS NOT NULL THEN 'teacher'
      WHEN a.id IS NOT NULL THEN 'admin'
      ELSE 'unknown'
    END as user_type,
    COALESCE(s.id, t.id, a.id) as record_id,
    COALESCE(s.name, t.name, a.name) as name,
    COALESCE(s.email, t.email, a.email) as email,
    COALESCE(s.department, t.department, 'N/A') as department,
    CASE 
      WHEN s.id IS NOT NULL THEN jsonb_build_object(
        'student_id', s.student_id,
        'semester', s.semester,
        'academic_year', s.academic_year
      )
      WHEN t.id IS NOT NULL THEN jsonb_build_object(
        'employee_id', t.employee_id,
        'specialization', t.specialization
      )
      WHEN a.id IS NOT NULL THEN jsonb_build_object(
        'employee_id', a.employee_id,
        'role', a.role
      )
      ELSE '{}'::jsonb
    END as additional_info
  FROM (SELECT auth.uid() as uid) auth_user
  LEFT JOIN students s ON s.user_id = auth_user.uid
  LEFT JOIN teachers t ON t.user_id = auth_user.uid
  LEFT JOIN admins a ON a.user_id = auth_user.uid
  LIMIT 1;
$function$;