-- First, clear out existing departments and related data to start fresh
TRUNCATE TABLE exam_teacher_assignments CASCADE;
TRUNCATE TABLE answer_sheets CASCADE;
TRUNCATE TABLE grievances CASCADE;
TRUNCATE TABLE exam_enrollments CASCADE;
TRUNCATE TABLE exams CASCADE;
TRUNCATE TABLE subjects CASCADE;
TRUNCATE TABLE departments CASCADE;
TRUNCATE TABLE semesters CASCADE;

-- Insert the 3 engineering departments as requested
INSERT INTO departments (name, code) VALUES 
('Computer Engineering', 'COMP'),
('Computer Science Engineering', 'CSE'),
('Electronics & Telecommunication Engineering', 'EXTC');

-- Create semesters
INSERT INTO semesters (name, academic_year, start_date, end_date, is_active) VALUES 
('Semester 1', '2024-25', '2024-08-01', '2024-12-31', false),
('Semester 2', '2024-25', '2025-01-01', '2025-05-31', false),
('Semester 3', '2024-25', '2025-01-01', '2025-05-31', true),
('Semester 4', '2023-24', '2024-01-01', '2024-05-31', false),
('Semester 5', '2023-24', '2023-08-01', '2023-12-31', false),
('Semester 6', '2022-23', '2023-01-01', '2023-05-31', false),
('Semester 7', '2021-22', '2021-08-01', '2021-12-31', false),
('Semester 8', '2021-22', '2022-01-01', '2022-05-31', false);

-- Insert subjects for each department
INSERT INTO subjects (name, code, department_id, semester_id, credits)
SELECT 
  subject_name,
  subject_code,
  d.id,
  s.id,
  3
FROM departments d
CROSS JOIN semesters s
CROSS JOIN (VALUES
  ('Operating Systems', 'OS', 'Computer Engineering', 'Semester 3'),
  ('Database Management Systems', 'DBMS', 'Computer Engineering', 'Semester 3'),
  ('Computer Networks', 'CN', 'Computer Engineering', 'Semester 5'),
  ('Data Structures and Algorithms', 'DSA', 'Computer Science Engineering', 'Semester 3'),
  ('Machine Learning', 'ML', 'Computer Science Engineering', 'Semester 5'),
  ('Digital Signal Processing', 'DSP', 'Electronics & Telecommunication Engineering', 'Semester 3'),
  ('Communication Systems', 'CS', 'Electronics & Telecommunication Engineering', 'Semester 5')
) AS subjects_data(subject_name, subject_code, dept_name, sem_name)
WHERE d.name = dept_name AND s.name = sem_name;

-- Create database functions for data access
CREATE OR REPLACE FUNCTION get_teachers_by_department(dept_name TEXT DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  name TEXT,
  email TEXT,
  department TEXT
) 
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name, p.email, p.department
  FROM profiles p 
  WHERE p.role = 'teacher'
    AND (dept_name IS NULL OR p.department = dept_name)
  ORDER BY p.name;
$$;

CREATE OR REPLACE FUNCTION get_departments()
RETURNS TABLE (
  id UUID,
  name TEXT,
  code TEXT
) 
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id, d.name, d.code
  FROM departments d 
  ORDER BY d.name;
$$;

CREATE OR REPLACE FUNCTION get_subjects_by_department(dept_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  name TEXT,
  code TEXT,
  department_name TEXT,
  semester_name TEXT,
  credits INTEGER
) 
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.name, s.code, d.name, sem.name, s.credits
  FROM subjects s
  JOIN departments d ON s.department_id = d.id
  JOIN semesters sem ON s.semester_id = sem.id
  WHERE (dept_id IS NULL OR s.department_id = dept_id)
  ORDER BY d.name, sem.name, s.name;
$$;

CREATE OR REPLACE FUNCTION get_active_semester()
RETURNS TABLE (
  id UUID,
  name TEXT,
  academic_year TEXT
) 
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.name, s.academic_year
  FROM semesters s 
  WHERE s.is_active = true
  LIMIT 1;
$$;