-- Create students table
CREATE TABLE public.students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL UNIQUE, -- Roll number or student ID
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  department TEXT NOT NULL,
  semester TEXT,
  academic_year TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create teachers table
CREATE TABLE public.teachers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL UNIQUE, -- Employee ID
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  department TEXT NOT NULL,
  specialization TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create admins table
CREATE TABLE public.admins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL UNIQUE, -- Employee ID
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin', -- admin or controller
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- RLS Policies for students
CREATE POLICY "Students can view their own record" ON public.students FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Students can update their own record" ON public.students FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Admins can manage students" ON public.students FOR ALL USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));
CREATE POLICY "Teachers can view students" ON public.students FOR SELECT USING (EXISTS (SELECT 1 FROM public.teachers WHERE user_id = auth.uid()));

-- RLS Policies for teachers
CREATE POLICY "Teachers can view their own record" ON public.teachers FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Teachers can update their own record" ON public.teachers FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Admins can manage teachers" ON public.teachers FOR ALL USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));
CREATE POLICY "Teachers can view other teachers" ON public.teachers FOR SELECT USING (EXISTS (SELECT 1 FROM public.teachers WHERE user_id = auth.uid()));

-- RLS Policies for admins
CREATE POLICY "Admins can view their own record" ON public.admins FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins can update their own record" ON public.admins FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Admins can manage other admins" ON public.admins FOR ALL USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));

-- Create updated_at triggers
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_teachers_updated_at BEFORE UPDATE ON public.teachers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_admins_updated_at BEFORE UPDATE ON public.admins FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Update database functions to work with new tables
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 
    CASE 
      WHEN EXISTS (SELECT 1 FROM public.students WHERE user_id = auth.uid()) THEN 'student'
      WHEN EXISTS (SELECT 1 FROM public.teachers WHERE user_id = auth.uid()) THEN 'teacher'
      WHEN EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()) THEN 'admin'
      ELSE 'unknown'
    END;
$function$;

-- Update handle_new_user function to create appropriate records
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_role text;
BEGIN
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'student');
  
  -- Create profile record (keep for backward compatibility)
  INSERT INTO public.profiles (user_id, name, email, role, department)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    user_role,
    NEW.raw_user_meta_data->>'department'
  );
  
  -- Create specific role record
  IF user_role = 'student' THEN
    INSERT INTO public.students (user_id, student_id, name, email, department, semester, academic_year)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'student_id', 'STU' || substr(NEW.id::text, 1, 8)),
      COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'department', 'General'),
      NEW.raw_user_meta_data->>'semester',
      NEW.raw_user_meta_data->>'academic_year'
    );
  ELSIF user_role = 'teacher' THEN
    INSERT INTO public.teachers (user_id, employee_id, name, email, department, specialization)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'employee_id', 'EMP' || substr(NEW.id::text, 1, 8)),
      COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'department', 'General'),
      NEW.raw_user_meta_data->>'specialization'
    );
  ELSIF user_role IN ('admin', 'controller') THEN
    INSERT INTO public.admins (user_id, employee_id, name, email, role)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'employee_id', 'ADM' || substr(NEW.id::text, 1, 8)),
      COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
      NEW.email,
      user_role
    );
  END IF;
  
  RETURN NEW;
END;
$function$;