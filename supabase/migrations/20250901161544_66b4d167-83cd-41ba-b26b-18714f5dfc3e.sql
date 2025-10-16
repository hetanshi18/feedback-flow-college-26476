-- Create the admin user record and fix infinite recursion completely

-- First, create the missing admin user record
INSERT INTO public.admins (user_id, employee_id, name, email, role)
SELECT 
  'e1f47568-6ce7-47d9-b13c-2d54b6ba2f86'::uuid,
  'ADM001',
  'Mahir Shah', 
  'admin@gmail.com',
  'admin'
WHERE NOT EXISTS (
  SELECT 1 FROM public.admins WHERE user_id = 'e1f47568-6ce7-47d9-b13c-2d54b6ba2f86'::uuid
);

-- Drop and recreate all RLS policies to eliminate ANY possibility of recursion
-- Drop ALL existing policies first
DROP POLICY IF EXISTS "Teachers can view all teachers" ON public.teachers;
DROP POLICY IF EXISTS "Teachers can update own record" ON public.teachers;
DROP POLICY IF EXISTS "Admins can manage teachers" ON public.teachers;

DROP POLICY IF EXISTS "Students can view own record" ON public.students;
DROP POLICY IF EXISTS "Students can update own record" ON public.students;
DROP POLICY IF EXISTS "Teachers can view all students" ON public.students;
DROP POLICY IF EXISTS "Admins can manage students" ON public.students;

DROP POLICY IF EXISTS "Admins can view own record" ON public.admins;
DROP POLICY IF EXISTS "Admins can update own record" ON public.admins;
DROP POLICY IF EXISTS "Admins can manage all admins" ON public.admins;

-- Create simple, non-recursive policies using only auth.uid() directly
CREATE POLICY "Teachers view policy" 
ON public.teachers 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Teachers update policy" 
ON public.teachers 
FOR UPDATE 
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins manage teachers" 
ON public.teachers 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admins 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Students view policy" 
ON public.students 
FOR SELECT 
TO authenticated
USING (
  user_id = auth.uid() 
  OR EXISTS (SELECT 1 FROM public.teachers WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
);

CREATE POLICY "Students update policy" 
ON public.students 
FOR UPDATE 
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins manage students" 
ON public.students 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admins 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins view policy" 
ON public.admins 
FOR SELECT 
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins update policy" 
ON public.admins 
FOR UPDATE 
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins manage policy" 
ON public.admins 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admins a2 
    WHERE a2.user_id = auth.uid()
  )
);