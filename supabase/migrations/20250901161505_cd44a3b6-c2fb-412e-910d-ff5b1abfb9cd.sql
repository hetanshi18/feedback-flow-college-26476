-- Fix infinite recursion in RLS policies for teachers table

-- Drop existing problematic policies on teachers table
DROP POLICY IF EXISTS "Teachers can view other teachers" ON public.teachers;
DROP POLICY IF EXISTS "Teachers can view their own record" ON public.teachers;
DROP POLICY IF EXISTS "Teachers can update their own record" ON public.teachers;
DROP POLICY IF EXISTS "Admins can manage teachers" ON public.teachers;

-- Create simpler, non-recursive policies for teachers
CREATE POLICY "Teachers can view all teachers" 
ON public.teachers 
FOR SELECT 
USING (true);

CREATE POLICY "Teachers can update own record" 
ON public.teachers 
FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage teachers" 
ON public.teachers 
FOR ALL 
USING (auth.uid() IN (SELECT user_id FROM public.admins));

-- Fix students table policies too to prevent similar issues
DROP POLICY IF EXISTS "Students can view their own record" ON public.students;
DROP POLICY IF EXISTS "Students can update their own record" ON public.students;
DROP POLICY IF EXISTS "Teachers can view students" ON public.students;
DROP POLICY IF EXISTS "Admins can manage students" ON public.students;

CREATE POLICY "Students can view own record" 
ON public.students 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Students can update own record" 
ON public.students 
FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Teachers can view all students" 
ON public.students 
FOR SELECT 
USING (auth.uid() IN (SELECT user_id FROM public.teachers));

CREATE POLICY "Admins can manage students" 
ON public.students 
FOR ALL 
USING (auth.uid() IN (SELECT user_id FROM public.admins));

-- Fix admins table policies
DROP POLICY IF EXISTS "Admins can view their own record" ON public.admins;
DROP POLICY IF EXISTS "Admins can update their own record" ON public.admins;  
DROP POLICY IF EXISTS "Admins can manage other admins" ON public.admins;

CREATE POLICY "Admins can view own record" 
ON public.admins 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Admins can update own record" 
ON public.admins 
FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all admins" 
ON public.admins 
FOR ALL 
USING (auth.uid() IN (SELECT user_id FROM public.admins));