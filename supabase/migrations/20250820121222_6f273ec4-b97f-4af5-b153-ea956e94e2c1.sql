-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends auth.users with additional fields)
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin', 'controller')),
  department TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Departments table
CREATE TABLE public.departments (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Semesters table
CREATE TABLE public.semesters (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Subjects table
CREATE TABLE public.subjects (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  semester_id UUID NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
  credits INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Exams table
CREATE TABLE public.exams (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  exam_date DATE NOT NULL,
  start_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL,
  total_marks INTEGER NOT NULL DEFAULT 100,
  question_paper_url TEXT,
  instructions TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'ongoing', 'completed', 'cancelled')),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Teacher assignments for exams
CREATE TABLE public.exam_teacher_assignments (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_questions INTEGER[] NOT NULL DEFAULT '{}',
  marks_per_question JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(exam_id, teacher_id)
);

-- Student enrollments in exams
CREATE TABLE public.exam_enrollments (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  enrollment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'enrolled' CHECK (status IN ('enrolled', 'appeared', 'absent')),
  UNIQUE(exam_id, student_id)
);

-- Answer sheets
CREATE TABLE public.answer_sheets (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  upload_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  total_marks INTEGER,
  obtained_marks INTEGER DEFAULT 0,
  grading_status TEXT NOT NULL DEFAULT 'pending' CHECK (grading_status IN ('pending', 'in_progress', 'completed', 'reviewed')),
  graded_by UUID REFERENCES public.profiles(id),
  graded_at TIMESTAMP WITH TIME ZONE,
  remarks TEXT,
  UNIQUE(exam_id, student_id)
);

-- Question-wise marks for answer sheets
CREATE TABLE public.answer_sheet_questions (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  answer_sheet_id UUID NOT NULL REFERENCES public.answer_sheets(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL,
  sub_question TEXT,
  max_marks NUMERIC(5,2) NOT NULL,
  obtained_marks NUMERIC(5,2) DEFAULT 0,
  comments TEXT,
  graded_by UUID REFERENCES public.profiles(id),
  graded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(answer_sheet_id, question_number, sub_question)
);

-- PDF annotations for answer sheets
CREATE TABLE public.answer_sheet_annotations (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  answer_sheet_id UUID NOT NULL REFERENCES public.answer_sheets(id) ON DELETE CASCADE,
  question_id UUID REFERENCES public.answer_sheet_questions(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  x_position NUMERIC(8,2) NOT NULL,
  y_position NUMERIC(8,2) NOT NULL,
  annotation_type TEXT NOT NULL CHECK (annotation_type IN ('check', 'cross', 'circle', 'highlight', 'pen', 'text', 'eraser')),
  content TEXT,
  color TEXT DEFAULT '#000000',
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Grievances table
CREATE TABLE public.grievances (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  answer_sheet_id UUID NOT NULL REFERENCES public.answer_sheets(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL,
  sub_question TEXT,
  grievance_text TEXT NOT NULL,
  current_marks NUMERIC(5,2) NOT NULL,
  expected_marks NUMERIC(5,2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'resolved', 'rejected')),
  teacher_response TEXT,
  updated_marks NUMERIC(5,2),
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES public.profiles(id)
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answer_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answer_sheet_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answer_sheet_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grievances ENABLE ROW LEVEL SECURITY;

-- Create security definer function to get current user profile
CREATE OR REPLACE FUNCTION public.get_current_user_profile()
RETURNS public.profiles AS $$
  SELECT * FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Create security definer function to get current user role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Admins can insert profiles" ON public.profiles
  FOR INSERT WITH CHECK (public.get_current_user_role() IN ('admin', 'controller'));

-- RLS Policies for departments (public read, admin write)
CREATE POLICY "Anyone can view departments" ON public.departments
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage departments" ON public.departments
  FOR ALL USING (public.get_current_user_role() IN ('admin', 'controller'));

-- RLS Policies for semesters (public read, admin write)
CREATE POLICY "Anyone can view semesters" ON public.semesters
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage semesters" ON public.semesters
  FOR ALL USING (public.get_current_user_role() IN ('admin', 'controller'));

-- RLS Policies for subjects (public read, admin write)
CREATE POLICY "Anyone can view subjects" ON public.subjects
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage subjects" ON public.subjects
  FOR ALL USING (public.get_current_user_role() IN ('admin', 'controller'));

-- RLS Policies for exams
CREATE POLICY "Anyone can view exams" ON public.exams
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage exams" ON public.exams
  FOR ALL USING (public.get_current_user_role() IN ('admin', 'controller'));

-- RLS Policies for exam teacher assignments
CREATE POLICY "Teachers can view their assignments" ON public.exam_teacher_assignments
  FOR SELECT USING (teacher_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can view all assignments" ON public.exam_teacher_assignments
  FOR SELECT USING (public.get_current_user_role() IN ('admin', 'controller'));

CREATE POLICY "Admins can manage assignments" ON public.exam_teacher_assignments
  FOR ALL USING (public.get_current_user_role() IN ('admin', 'controller'));

-- RLS Policies for exam enrollments
CREATE POLICY "Students can view their enrollments" ON public.exam_enrollments
  FOR SELECT USING (student_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Teachers and admins can view enrollments" ON public.exam_enrollments
  FOR SELECT USING (public.get_current_user_role() IN ('teacher', 'admin', 'controller'));

CREATE POLICY "Admins can manage enrollments" ON public.exam_enrollments
  FOR ALL USING (public.get_current_user_role() IN ('admin', 'controller'));

-- RLS Policies for answer sheets
CREATE POLICY "Students can view their answer sheets" ON public.answer_sheets
  FOR SELECT USING (student_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can view assigned answer sheets" ON public.answer_sheets
  FOR SELECT USING (
    public.get_current_user_role() = 'teacher' AND
    exam_id IN (
      SELECT exam_id FROM public.exam_teacher_assignments 
      WHERE teacher_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Admins can view all answer sheets" ON public.answer_sheets
  FOR SELECT USING (public.get_current_user_role() IN ('admin', 'controller'));

CREATE POLICY "Students can upload their answer sheets" ON public.answer_sheets
  FOR INSERT WITH CHECK (student_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can update assigned answer sheets" ON public.answer_sheets
  FOR UPDATE USING (
    public.get_current_user_role() = 'teacher' AND
    exam_id IN (
      SELECT exam_id FROM public.exam_teacher_assignments 
      WHERE teacher_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
  );

-- RLS Policies for answer sheet questions
CREATE POLICY "Students can view their question marks" ON public.answer_sheet_questions
  FOR SELECT USING (
    answer_sheet_id IN (
      SELECT id FROM public.answer_sheets 
      WHERE student_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Teachers can manage assigned question marks" ON public.answer_sheet_questions
  FOR ALL USING (
    public.get_current_user_role() = 'teacher' AND
    answer_sheet_id IN (
      SELECT as_table.id FROM public.answer_sheets as_table
      JOIN public.exam_teacher_assignments eta ON as_table.exam_id = eta.exam_id
      WHERE eta.teacher_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Admins can view all question marks" ON public.answer_sheet_questions
  FOR SELECT USING (public.get_current_user_role() IN ('admin', 'controller'));

-- RLS Policies for annotations
CREATE POLICY "Teachers can manage annotations for assigned papers" ON public.answer_sheet_annotations
  FOR ALL USING (
    public.get_current_user_role() = 'teacher' AND
    answer_sheet_id IN (
      SELECT as_table.id FROM public.answer_sheets as_table
      JOIN public.exam_teacher_assignments eta ON as_table.exam_id = eta.exam_id
      WHERE eta.teacher_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Students can view annotations on their papers" ON public.answer_sheet_annotations
  FOR SELECT USING (
    answer_sheet_id IN (
      SELECT id FROM public.answer_sheets 
      WHERE student_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
  );

-- RLS Policies for grievances
CREATE POLICY "Students can manage their grievances" ON public.grievances
  FOR ALL USING (student_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can view and respond to grievances for their papers" ON public.grievances
  FOR SELECT USING (
    public.get_current_user_role() = 'teacher' AND
    answer_sheet_id IN (
      SELECT as_table.id FROM public.answer_sheets as_table
      JOIN public.exam_teacher_assignments eta ON as_table.exam_id = eta.exam_id
      WHERE eta.teacher_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Teachers can update grievances for their papers" ON public.grievances
  FOR UPDATE USING (
    public.get_current_user_role() = 'teacher' AND
    answer_sheet_id IN (
      SELECT as_table.id FROM public.answer_sheets as_table
      JOIN public.exam_teacher_assignments eta ON as_table.exam_id = eta.exam_id
      WHERE eta.teacher_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Admins can view all grievances" ON public.grievances
  FOR SELECT USING (public.get_current_user_role() IN ('admin', 'controller'));

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_exams_updated_at
  BEFORE UPDATE ON public.exams
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Insert sample departments
INSERT INTO public.departments (name, code) VALUES
  ('Computer Engineering', 'CE'),
  ('Information Technology', 'IT'),
  ('Electronics Engineering', 'EE'),
  ('Mechanical Engineering', 'ME')
ON CONFLICT (name) DO NOTHING;

-- Insert sample semester
INSERT INTO public.semesters (name, academic_year, start_date, end_date, is_active) VALUES
  ('Semester 3', '2024-25', '2024-08-01', '2024-12-31', true),
  ('Semester 4', '2024-25', '2025-01-01', '2025-05-31', false),
  ('Semester 5', '2024-25', '2024-08-01', '2024-12-31', true)
ON CONFLICT DO NOTHING;

-- Create storage bucket for answer sheets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'answer-sheets',
  'answer-sheets',
  false,
  52428800, -- 50MB limit
  array['application/pdf', 'image/jpeg', 'image/png']
) ON CONFLICT (id) DO NOTHING;

-- Create storage policies for answer sheets
CREATE POLICY "Students can upload their answer sheets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'answer-sheets' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Students can view their answer sheets"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'answer-sheets' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Teachers can view assigned answer sheets"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'answer-sheets' AND
  public.get_current_user_role() = 'teacher'
);

CREATE POLICY "Admins can view all answer sheets"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'answer-sheets' AND
  public.get_current_user_role() IN ('admin', 'controller')
);