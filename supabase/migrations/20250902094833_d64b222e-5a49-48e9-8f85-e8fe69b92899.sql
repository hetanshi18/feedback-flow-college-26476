-- Get the user_id for the profile that doesn't have a student record
INSERT INTO public.students (id, user_id, student_id, name, email, department)
SELECT 
    p.id,
    p.user_id,
    'STU' || substr(p.user_id::text, 1, 8),
    p.name,
    p.email,
    COALESCE(p.department, 'General')
FROM profiles p
WHERE p.id = 'dc86b982-048c-421b-9ab4-52e46d0f058b'
AND p.role = 'student'
AND NOT EXISTS (SELECT 1 FROM students s WHERE s.id = p.id);

-- Now fix the foreign key constraint
ALTER TABLE public.exam_enrollments 
DROP CONSTRAINT exam_enrollments_student_id_fkey;

ALTER TABLE public.exam_enrollments 
ADD CONSTRAINT exam_enrollments_student_id_fkey 
FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;