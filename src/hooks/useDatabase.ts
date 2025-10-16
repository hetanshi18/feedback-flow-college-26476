import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useDepartments = () => {
  const [departments, setDepartments] = useState<Array<{id: string, name: string, code: string}>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const { data, error } = await supabase.rpc('get_departments');
        if (error) throw error;
        setDepartments(data || []);
      } catch (err) {
        console.error('Error fetching departments:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch departments');
      } finally {
        setLoading(false);
      }
    };

    fetchDepartments();
  }, []);

  return { departments, loading, error };
};

export const useTeachers = (departmentName?: string) => {
  const [teachers, setTeachers] = useState<Array<{id: string, name: string, email: string, department: string}>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        const { data, error } = await supabase.rpc('get_teachers_by_department', { dept_name: departmentName || null });
        if (error) throw error;
        setTeachers(data || []);
      } catch (err) {
        console.error('Error fetching teachers:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch teachers');
      } finally {
        setLoading(false);
      }
    };

    fetchTeachers();
  }, [departmentName]);

  return { teachers, loading, error };
};

export const useStudents = (departmentName?: string) => {
  const [students, setStudents] = useState<Array<{
    id: string,
    student_id: string,
    name: string,
    email: string,
    department: string,
    semester: string,
    academic_year: string
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const { data, error } = await supabase.rpc('get_students_by_department', { dept_name: departmentName || null });
        if (error) throw error;
        setStudents(data || []);
      } catch (err) {
        console.error('Error fetching students:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch students');
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, [departmentName]);

  return { students, loading, error };
};

export const useSubjects = (departmentId?: string) => {
  const [subjects, setSubjects] = useState<Array<{
    id: string, 
    name: string, 
    code: string, 
    department_name: string, 
    semester_name: string, 
    credits: number
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const { data, error } = await supabase.rpc('get_subjects_by_department', { dept_id: departmentId || null });
        if (error) throw error;
        setSubjects(data || []);
      } catch (err) {
        console.error('Error fetching subjects:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch subjects');
      } finally {
        setLoading(false);
      }
    };

    fetchSubjects();
  }, [departmentId]);

  return { subjects, loading, error };
};

export const useExams = () => {
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExams = async () => {
    try {
      setLoading(true);
      
      // Simplified query that works with our RLS policies
      const { data: examsData, error: examsError } = await supabase
        .from('exams')
        .select('*');
      
      if (examsError) throw examsError;
      
      // Get subjects separately
      const { data: subjects } = await supabase
        .from('subjects')
        .select('*, department:departments(*)');
      
      // Get assignments separately  
      const { data: assignments } = await supabase
        .from('exam_teacher_assignments')
        .select('*, teacher:teachers(*)');
      
      // Combine the data manually
      const enrichedExams = examsData.map(exam => {
        const subject = subjects?.find(s => s.id === exam.subject_id);
        const examAssignments = assignments?.filter(a => a.exam_id === exam.id) || [];
        
        return {
          ...exam,
          subject,
          exam_teacher_assignments: examAssignments
        };
      });
      
      setExams(enrichedExams || []);
    } catch (err) {
      console.error('Error fetching exams:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch exams');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();

    // Set up real-time subscription for exam changes
    const channel = supabase
      .channel('exam_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'exams' }, 
        () => fetchExams()
      )
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'exam_teacher_assignments' }, 
        () => fetchExams()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { exams, loading, error, refetch: fetchExams };
};

export const useAnswerSheets = (currentStudentId?: string, role?: string) => {
  const [answerSheets, setAnswerSheets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnswerSheets = async () => {
    if (!currentStudentId) return;
    
    try {
      setLoading(true);
      let query = supabase
        .from('answer_sheets')
        .select(`
          *,
          exam:exams(
            name,
            subject:subjects(name, department:departments(name))
          ),
          student:students(name, email),
          grader:teachers(name)
        `);

      // Filter based on role
      if (role === 'student') {
        // currentStudentId is already the student ID, so use it directly
        query = query.eq('student_id', currentStudentId);
      } else if (role === 'teacher') {
        // Teachers only see sheets assigned to them
        // For teachers, we need to get the user ID from auth context
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        const { data: teacherData } = await supabase
          .from('teachers')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
          
        if (teacherData) {
          const { data: assignedExams } = await supabase
            .from('exam_teacher_assignments')
            .select('exam_id')
            .eq('teacher_id', teacherData.id);
          
          const examIds = assignedExams?.map(a => a.exam_id) || [];
          if (examIds.length > 0) {
            query = query.in('exam_id', examIds);
          } else {
            // No assignments, return empty
            setAnswerSheets([]);
            setLoading(false);
            return;
          }
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      setAnswerSheets(data || []);
    } catch (err) {
      console.error('Error fetching answer sheets:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch answer sheets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnswerSheets();

    // Set up real-time subscription for answer sheet changes
    const channel = supabase
      .channel('answer_sheet_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'answer_sheets' }, 
        () => fetchAnswerSheets()
      )
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'exam_teacher_assignments' }, 
        () => fetchAnswerSheets()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentStudentId, role]);

  return { answerSheets, loading, error, refetch: fetchAnswerSheets };
};

export const useGrievances = (currentStudentId?: string, role?: string) => {
  const [grievances, setGrievances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGrievances = async () => {
      if (!currentStudentId) return;
      
      try {
        let query = supabase
          .from('grievances')
          .select(`
            *,
            answer_sheet:answer_sheets(
              id,
              file_url,
              obtained_marks,
              total_marks,
              exam:exams(
                name,
                subject:subjects(name)
              ),
              student:students(name)
            ),
            student:students(name),
            reviewer:teachers(name)
          `);

        // Filter based on role
        if (role === 'student') {
          // currentStudentId is already the student ID, so use it directly
          query = query.eq('student_id', currentStudentId);
        } else if (role === 'teacher') {
          // Teachers see grievances for papers they grade
          // For teachers, we need to get the user ID from auth context
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          
          const { data: teacherData } = await supabase
            .from('teachers')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle();
            
          if (teacherData) {
            const { data: assignedSheets } = await supabase
              .from('exam_teacher_assignments')
              .select('exam_id')
              .eq('teacher_id', teacherData.id);
            
            if (assignedSheets && assignedSheets.length > 0) {
              const { data: answerSheets } = await supabase
                .from('answer_sheets')
                .select('id')
                .in('exam_id', assignedSheets.map(a => a.exam_id));
              
              const sheetIds = answerSheets?.map(s => s.id) || [];
              if (sheetIds.length > 0) {
                query = query.in('answer_sheet_id', sheetIds);
              }
            }
          }
        }

        const { data, error } = await query;
        if (error) throw error;
        setGrievances(data || []);
      } catch (err) {
        console.error('Error fetching grievances:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch grievances');
      } finally {
        setLoading(false);
      }
    };

    fetchGrievances();
  }, [currentStudentId, role]);

  const updateGrievanceStatus = async (grievanceId: string, status: string, response?: string, updatedMarks?: number) => {
    try {
      // Get current teacher ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      const { data: teacherData } = await supabase
        .from('teachers')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (!teacherData) throw new Error('Teacher not found');
      
      const updates: any = { status };
      if (response) updates.teacher_response = response;
      if (updatedMarks !== undefined) updates.updated_marks = updatedMarks;
      updates.reviewed_at = new Date().toISOString();
      updates.reviewed_by = teacherData.id;

      const { error } = await supabase
        .from('grievances')
        .update(updates)
        .eq('id', grievanceId);

      if (error) throw error;

      // Update local state
      setGrievances(prev => prev.map(g => 
        g.id === grievanceId ? { ...g, ...updates } : g
      ));

      toast.success(`Grievance ${status} successfully!`);
    } catch (err) {
      console.error('Error updating grievance:', err);
      toast.error('Failed to update grievance');
    }
  };

  return { grievances, loading, error, updateGrievanceStatus };
};

// Hook for teacher exam assignments
export const useTeacherExams = (teacherId?: string) => {
  const [teacherExams, setTeacherExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTeacherExams = async () => {
    if (!teacherId) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      
      // Direct query that should work
      const { data, error } = await supabase
        .from('exam_teacher_assignments')
        .select(`
          *,
          exam:exams(
            *,
            subject:subjects(name, code, department:departments(name))
          )
        `)
        .eq('teacher_id', teacherId);

      if (error) {
        console.error('Database error:', error);
        throw error;
      }
      
      console.log('Fetched teacher exams:', data);
      setTeacherExams(data || []);
    } catch (err) {
      console.error('Error fetching teacher exams:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch teacher exams');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeacherExams();

    // Set up real-time subscription for teacher assignment changes
    const channel = supabase
      .channel('teacher_exam_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'exam_teacher_assignments', filter: `teacher_id=eq.${teacherId}` }, 
        () => fetchTeacherExams()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teacherId]);

  return { teacherExams, loading, error, refetch: fetchTeacherExams };
};

// Hook for student enrollments
export const useStudentEnrollments = (studentId?: string) => {
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEnrollments = async () => {
      if (!studentId) return;
      
      try {
        const { data, error } = await supabase
          .from('exam_enrollments')
          .select(`
            *,
            exam:exams(
              *,
              subject:subjects(name, code, department:departments(name))
            )
          `)
          .eq('student_id', studentId);

        if (error) throw error;
        setEnrollments(data || []);
      } catch (err) {
        console.error('Error fetching student enrollments:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch enrollments');
      } finally {
        setLoading(false);
      }
    };

    fetchEnrollments();

    // Set up real-time subscription for enrollment changes
    const channel = supabase
      .channel('student_enrollment_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'exam_enrollments', filter: `student_id=eq.${studentId}` }, 
        () => fetchEnrollments()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [studentId]);

  return { enrollments, loading, error };
};

// Hook for current user details
export const useCurrentUser = () => {
  const [userDetails, setUserDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        const { data, error } = await supabase.rpc('get_current_user_details');
        if (error) throw error;
        setUserDetails(data?.[0] || null);
      } catch (err) {
        console.error('Error fetching user details:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch user details');
      } finally {
        setLoading(false);
      }
    };

    fetchUserDetails();
  }, []);

  return { userDetails, loading, error };
};