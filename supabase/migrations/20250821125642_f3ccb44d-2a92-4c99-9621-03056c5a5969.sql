-- Insert the 3 engineering departments
INSERT INTO departments (name, code) VALUES 
('Computer Engineering', 'COMP'),
('Computer Science Engineering', 'CSE'),
('Electronics & Telecommunication Engineering', 'EXTC')
ON CONFLICT (code) DO NOTHING;

-- Create current semester
INSERT INTO semesters (name, academic_year, start_date, end_date, is_active) VALUES 
('Semester 1', '2024-25', '2024-08-01', '2024-12-31', true),
('Semester 2', '2024-25', '2025-01-01', '2025-05-31', false),
('Semester 3', '2023-24', '2023-08-01', '2023-12-31', false),
('Semester 4', '2023-24', '2024-01-01', '2024-05-31', false),
('Semester 5', '2022-23', '2022-08-01', '2022-12-31', false),
('Semester 6', '2022-23', '2023-01-01', '2023-05-31', false),
('Semester 7', '2021-22', '2021-08-01', '2021-12-31', false),
('Semester 8', '2021-22', '2022-01-01', '2022-05-31', false)
ON CONFLICT DO NOTHING;

-- Get department and semester IDs for subjects
WITH dept_sem AS (
  SELECT 
    d.id as dept_id, d.name as dept_name,
    s.id as sem_id, s.name as sem_name
  FROM departments d 
  CROSS JOIN semesters s
  WHERE d.name IN ('Computer Engineering', 'Computer Science Engineering', 'Electronics & Telecommunication Engineering')
)
-- Insert subjects for each department and semester
INSERT INTO subjects (name, code, department_id, semester_id, credits)
SELECT 
  CASE 
    WHEN dept_name = 'Computer Engineering' AND sem_name = 'Semester 3' THEN 'Operating Systems'
    WHEN dept_name = 'Computer Engineering' AND sem_name = 'Semester 3' THEN 'Database Management Systems'
    WHEN dept_name = 'Computer Engineering' AND sem_name = 'Semester 5' THEN 'Computer Networks'
    WHEN dept_name = 'Computer Science Engineering' AND sem_name = 'Semester 3' THEN 'Data Structures and Algorithms'
    WHEN dept_name = 'Computer Science Engineering' AND sem_name = 'Semester 5' THEN 'Machine Learning'
    WHEN dept_name = 'Electronics & Telecommunication Engineering' AND sem_name = 'Semester 3' THEN 'Digital Signal Processing'
    WHEN dept_name = 'Electronics & Telecommunication Engineering' AND sem_name = 'Semester 5' THEN 'Communication Systems'
    ELSE 'General Engineering Mathematics'
  END as subject_name,
  CASE 
    WHEN dept_name = 'Computer Engineering' AND sem_name = 'Semester 3' THEN 'COMP301'
    WHEN dept_name = 'Computer Engineering' AND sem_name = 'Semester 3' THEN 'COMP302'
    WHEN dept_name = 'Computer Engineering' AND sem_name = 'Semester 5' THEN 'COMP501'
    WHEN dept_name = 'Computer Science Engineering' AND sem_name = 'Semester 3' THEN 'CSE301'
    WHEN dept_name = 'Computer Science Engineering' AND sem_name = 'Semester 5' THEN 'CSE501'
    WHEN dept_name = 'Electronics & Telecommunication Engineering' AND sem_name = 'Semester 3' THEN 'EXTC301'
    WHEN dept_name = 'Electronics & Telecommunication Engineering' AND sem_name = 'Semester 5' THEN 'EXTC501'
    ELSE 'GEN' || sem_name
  END as subject_code,
  dept_id,
  sem_id,
  3 as credits
FROM dept_sem
WHERE 
  (dept_name = 'Computer Engineering' AND sem_name IN ('Semester 3', 'Semester 5')) OR
  (dept_name = 'Computer Science Engineering' AND sem_name IN ('Semester 3', 'Semester 5')) OR
  (dept_name = 'Electronics & Telecommunication Engineering' AND sem_name IN ('Semester 3', 'Semester 5'))
ON CONFLICT (code) DO NOTHING;

-- Create function to get teachers by department
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

-- Create function to get departments
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

-- Create function to get subjects by department
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

-- Create function to get active semester
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