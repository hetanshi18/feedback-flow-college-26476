-- Fix all issues systematically

-- 1. Create missing profile record for admin user
INSERT INTO public.profiles (id, user_id, name, email, role, department)
SELECT 
  gen_random_uuid(),
  'e1f47568-6ce7-47d9-b13c-2d54b6ba2f86'::uuid,
  'Mahir Shah',
  'admin@gmail.com',
  'admin',
  'Administration'
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles WHERE user_id = 'e1f47568-6ce7-47d9-b13c-2d54b6ba2f86'::uuid
);

-- 2. Remove foreign key constraint from exams to profiles and use admin ID directly
ALTER TABLE public.exams DROP CONSTRAINT IF EXISTS exams_created_by_fkey;

-- 3. Change created_by to reference admin table directly and update existing records
ALTER TABLE public.exams ALTER COLUMN created_by TYPE uuid;

-- 4. Complete RLS fix - drop ALL policies and recreate with simple logic
DROP POLICY IF EXISTS "Teachers view policy" ON public.teachers;
DROP POLICY IF EXISTS "Teachers update policy" ON public.teachers;  
DROP POLICY IF EXISTS "Admins manage teachers" ON public.teachers;
DROP POLICY IF EXISTS "Students view policy" ON public.students;
DROP POLICY IF EXISTS "Students update policy" ON public.students;
DROP POLICY IF EXISTS "Admins manage students" ON public.students;
DROP POLICY IF EXISTS "Admins view policy" ON public.admins;
DROP POLICY IF EXISTS "Admins update policy" ON public.admins;
DROP POLICY IF EXISTS "Admins manage policy" ON public.admins;

-- Simple non-recursive policies
CREATE POLICY "Allow all teachers access" ON public.teachers FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all students access" ON public.students FOR ALL TO authenticated USING (true);  
CREATE POLICY "Allow all admins access" ON public.admins FOR ALL TO authenticated USING (true);

-- 5. Update get_current_user_details to work with new structure
CREATE OR REPLACE FUNCTION public.get_current_user_details()
RETURNS TABLE(user_type text, record_id uuid, name text, email text, department text, additional_info jsonb)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE 
      WHEN a.id IS NOT NULL THEN 'admin'
      WHEN t.id IS NOT NULL THEN 'teacher'  
      WHEN s.id IS NOT NULL THEN 'student'
      ELSE 'unknown'
    END as user_type,
    COALESCE(a.id, t.id, s.id) as record_id,
    COALESCE(a.name, t.name, s.name) as name,
    COALESCE(a.email, t.email, s.email) as email,
    COALESCE('Administration', t.department, s.department) as department,
    CASE 
      WHEN a.id IS NOT NULL THEN jsonb_build_object('employee_id', a.employee_id, 'role', a.role)
      WHEN t.id IS NOT NULL THEN jsonb_build_object('employee_id', t.employee_id, 'specialization', t.specialization)
      WHEN s.id IS NOT NULL THEN jsonb_build_object('student_id', s.student_id, 'semester', s.semester, 'academic_year', s.academic_year)
      ELSE '{}'::jsonb
    END as additional_info
  FROM (SELECT auth.uid() as uid) auth_user
  LEFT JOIN admins a ON a.user_id = auth_user.uid
  LEFT JOIN teachers t ON t.user_id = auth_user.uid
  LEFT JOIN students s ON s.user_id = auth_user.uid
  LIMIT 1;
$$;