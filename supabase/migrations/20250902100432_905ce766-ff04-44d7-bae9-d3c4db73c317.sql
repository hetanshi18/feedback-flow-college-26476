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

-- Drop existing conflicting policies if they exist
DROP POLICY IF EXISTS "Admins can view all answer sheets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload answer sheets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update answer sheets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete answer sheets" ON storage.objects;

-- Create RLS policies for question-papers bucket
CREATE POLICY "Admins can upload question papers" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'question-papers' 
  AND get_current_user_role() = ANY (ARRAY['admin'::text, 'controller'::text])
);

CREATE POLICY "Admins can view question papers" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'question-papers' 
  AND get_current_user_role() = ANY (ARRAY['admin'::text, 'controller'::text])
);

CREATE POLICY "Teachers can view question papers" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'question-papers' 
  AND get_current_user_role() = 'teacher'::text
);

CREATE POLICY "Students can view question papers when exam allows" 
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
CREATE POLICY "Admins can manage answer sheets" 
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

CREATE POLICY "Teachers can view assigned answer sheets" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'answer-sheets' 
  AND get_current_user_role() = 'teacher'::text
  AND name IN (
    SELECT SUBSTRING(as_table.file_url FROM '([^/]+)$') 
    FROM answer_sheets as_table
    JOIN exam_teacher_assignments eta ON as_table.exam_id = eta.exam_id
    WHERE eta.teacher_id = (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())
  )
);

CREATE POLICY "Students can view their answer sheets" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'answer-sheets' 
  AND get_current_user_role() = 'student'::text
  AND name IN (
    SELECT SUBSTRING(as_table.file_url FROM '([^/]+)$') 
    FROM answer_sheets as_table
    WHERE as_table.student_id = (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())
  )
);