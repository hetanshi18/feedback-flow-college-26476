-- Add question paper access tracking
ALTER TABLE public.exams 
ADD COLUMN IF NOT EXISTS question_paper_visible_to_students BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS question_paper_visible_to_teachers BOOLEAN DEFAULT false;

-- Update existing exams to make question papers visible to assigned teachers and enrolled students
UPDATE public.exams 
SET question_paper_visible_to_students = true, 
    question_paper_visible_to_teachers = true 
WHERE question_paper_url IS NOT NULL;