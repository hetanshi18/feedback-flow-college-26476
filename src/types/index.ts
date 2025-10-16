
export interface User {
  id: string;
  name?: string;
  email?: string;
  role?: 'teacher' | 'student' | 'admin' | 'controller';
  department?: string;
  user_metadata?: {
    name?: string;
    role?: string;
    department?: string;
  };
}

export interface Student {
  id: string;
  user_id: string;
  student_id: string;
  name: string;
  email: string;
  department: string;
  semester?: string;
  academic_year?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Teacher {
  id: string;
  user_id: string;
  employee_id: string;
  name: string;
  email: string;
  department: string;
  specialization?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Admin {
  id: string;
  user_id: string;
  employee_id: string;
  name: string;
  email: string;
  role: 'admin' | 'controller';
  created_at: Date;
  updated_at: Date;
}

export interface AnswerSheet {
  id: string;
  studentId: string;
  studentName: string;
  subject: string;
  examName: string;
  totalMarks: number;
  obtainedMarks: number;
  teacherId: string;
  teacherName: string;
  uploadDate: Date;
  fileUrl: string;
  semester: string;
  department: string;
}

export interface Question {
  id: string;
  questionNumber: number;
  totalMarks: number;
  obtainedMarks: number;
  comments?: string;
}

export interface Grievance {
  id: string;
  studentId: string;
  studentName: string;
  answerSheetId: string;
  subject: string;
  examName: string;
  questionNumber: number;
  subQuestionNumber?: string;
  grievanceText: string;
  status: 'pending' | 'under_review' | 'resolved' | 'rejected';
  teacherId: string;
  teacherName: string;
  submissionDate: Date;
  teacherResponse?: string;
  responseDate?: Date;
  currentMarks: number;
  updatedMarks?: number;
}

export interface Exam {
  id: string;
  name: string;
  subject: string;
  department: string;
  semester: string;
  date: Date;
  duration: number; // in minutes
  totalMarks: number;
  questionPaperUrl?: string;
  assignedTeachers: ExamTeacherAssignment[];
  createdAt: Date;
  createdBy: string;
}

export interface ExamTeacherAssignment {
  teacherId: string;
  teacherName: string;
  assignedQuestions: number[];
  marksPerQuestion: Record<number, number>;
}

// Remove the old AuthContextType as it's now defined in AuthContext.tsx
