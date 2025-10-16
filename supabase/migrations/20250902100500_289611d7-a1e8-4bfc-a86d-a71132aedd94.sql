-- Create storage buckets for question papers (answer-sheets already exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('question-papers', 'question-papers', false, 52428800, ARRAY['application/pdf']::text[])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Update answer-sheets bucket configuration
UPDATE storage.buckets 
SET file_size_limit = 52428800, allowed_mime_types = ARRAY['application/pdf']::text[]
WHERE id = 'answer-sheets';

-- Drop all existing storage policies for these buckets
DROP POLICY IF EXISTS "Admins can view all answer sheets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload answer sheets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update answer sheets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete answer sheets" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can view assigned answer sheets" ON storage.objects;
DROP POLICY IF EXISTS "Students can view their answer sheets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload question papers" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view question papers" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can view question papers" ON storage.objects;
DROP POLICY IF EXISTS "Students can view question papers when exam allows" ON storage.objects;

-- Create RLS policies for question-papers bucket
CREATE POLICY "Admin question paper management" 
ON storage.objects 
FOR ALL
USING (
  bucket_id = 'question-papers' 
  AND get_current_user_role() = ANY (ARRAY['admin'::text, 'controller'::text])
)
WITH CHECK (
  bucket_id = 'question-papers' 
  AND get_current_user_role() = ANY (ARRAY['admin'::text, 'controller'::text])
);

CREATE POLICY "Teacher question paper access" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'question-papers' 
  AND get_current_user_role() = 'teacher'::text
);

CREATE POLICY "Student question paper access when allowed" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'question-papers' 
  AND get_current_user_role() = 'student'::text
  AND EXISTS (
    SELECT 1 FROM exams e 
    WHERE e.question_paper_url = name 
    AND e.question_paper_visible_to_students = true
  )
);

-- Create RLS policies for answer-sheets bucket
CREATE POLICY "Admin answer sheet management" 
ON storage.objects 
FOR ALL 
USING (
  bucket_id = 'answer-sheets' 
  AND get_current_user_role() = ANY (ARRAY['admin'::text, 'controller'::text])
)
WITH CHECK (
  bucket_id = 'answer-sheets' 
  AND get_current_user_role() = ANY (ARRAY['admin'::text, 'controller'::text])
);

CREATE POLICY "Teacher answer sheet access" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'answer-sheets' 
  AND get_current_user_role() = 'teacher'::text
);

CREATE POLICY "Student answer sheet access" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'answer-sheets' 
  AND get_current_user_role() = 'student'::text
);