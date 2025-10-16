-- Create teacher record for admin user so they can see assignments
INSERT INTO public.teachers (user_id, employee_id, name, email, department, specialization)
SELECT 
  'e1f47568-6ce7-47d9-b13c-2d54b6ba2f86'::uuid,
  'TCH001',
  'Mahir Shah (Admin)', 
  'admin@gmail.com',
  'Administration',
  'System Administration'
WHERE NOT EXISTS (
  SELECT 1 FROM public.teachers WHERE user_id = 'e1f47568-6ce7-47d9-b13c-2d54b6ba2f86'::uuid
);

-- Now update the existing assignment to use the admin user as teacher
UPDATE public.exam_teacher_assignments 
SET teacher_id = (
  SELECT id FROM public.teachers WHERE user_id = 'e1f47568-6ce7-47d9-b13c-2d54b6ba2f86'::uuid
)
WHERE teacher_id = 'a7f76f62-850f-4149-bb54-a7c39f88bae0';