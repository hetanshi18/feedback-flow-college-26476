-- Add foreign key constraints to answer_sheets table
ALTER TABLE answer_sheets 
ADD CONSTRAINT fk_answer_sheets_exam 
FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE;

ALTER TABLE answer_sheets 
ADD CONSTRAINT fk_answer_sheets_student 
FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

-- Add foreign key constraints to exam_enrollments table
ALTER TABLE exam_enrollments 
ADD CONSTRAINT fk_exam_enrollments_exam 
FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE;

ALTER TABLE exam_enrollments 
ADD CONSTRAINT fk_exam_enrollments_student 
FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

-- Add foreign key constraints to exam_teacher_assignments table  
ALTER TABLE exam_teacher_assignments 
ADD CONSTRAINT fk_exam_teacher_assignments_exam 
FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE;

ALTER TABLE exam_teacher_assignments 
ADD CONSTRAINT fk_exam_teacher_assignments_teacher 
FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE;

-- Add foreign key constraints to answer_sheet_questions table
ALTER TABLE answer_sheet_questions 
ADD CONSTRAINT fk_answer_sheet_questions_answer_sheet 
FOREIGN KEY (answer_sheet_id) REFERENCES answer_sheets(id) ON DELETE CASCADE;

-- Add foreign key constraints to answer_sheet_annotations table
ALTER TABLE answer_sheet_annotations 
ADD CONSTRAINT fk_answer_sheet_annotations_answer_sheet 
FOREIGN KEY (answer_sheet_id) REFERENCES answer_sheets(id) ON DELETE CASCADE;

-- Add foreign key constraints to grievances table
ALTER TABLE grievances 
ADD CONSTRAINT fk_grievances_answer_sheet 
FOREIGN KEY (answer_sheet_id) REFERENCES answer_sheets(id) ON DELETE CASCADE;

ALTER TABLE grievances 
ADD CONSTRAINT fk_grievances_student 
FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

-- Add foreign key constraints to subjects table
ALTER TABLE subjects 
ADD CONSTRAINT fk_subjects_department 
FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE;

ALTER TABLE subjects 
ADD CONSTRAINT fk_subjects_semester 
FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE CASCADE;

-- Add foreign key constraint to exams table
ALTER TABLE exams 
ADD CONSTRAINT fk_exams_subject 
FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;