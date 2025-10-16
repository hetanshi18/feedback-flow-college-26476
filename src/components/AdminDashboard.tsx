
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useDepartments, useTeachers, useSubjects, useExams } from '@/hooks/useDatabase';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Users, BookOpen, GraduationCap, FileText, Calendar, Star, Edit, Upload } from 'lucide-react';
import AddExamDialog from './AddExamDialog';
import EditExamDialog from './EditExamDialog';
import ExamEnrollmentDialog from './ExamEnrollmentDialog';
import ExamStudentAssignmentDialog from './ExamStudentAssignmentDialog';
import FileUploadManager from './FileUploadManager';

const AdminDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [teacherAssignments, setTeacherAssignments] = useState<{[examId: string]: string}>({});
  const [isAddExamOpen, setIsAddExamOpen] = useState(false);
  const [isEditExamOpen, setIsEditExamOpen] = useState(false);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [isStudentAssignmentOpen, setIsStudentAssignmentOpen] = useState(false);
  const [selectedExamForStudents, setSelectedExamForStudents] = useState<any>(null);
  const [isEnrollmentDialogOpen, setIsEnrollmentDialogOpen] = useState(false);
  
  // Fetch data from database
  const { departments, loading: deptLoading } = useDepartments();
  const { teachers, loading: teachersLoading } = useTeachers();
  const { subjects, loading: subjectsLoading } = useSubjects();
  const { exams, loading: examsLoading, refetch } = useExams();

  const assignTeacher = async (examId: string, teacherId: string) => {
    try {
      // Check if assignment already exists
      const { data: existingAssignment } = await supabase
        .from('exam_teacher_assignments')
        .select('id')
        .eq('exam_id', examId)
        .eq('teacher_id', teacherId)
        .single();

      if (existingAssignment) {
        toast.info('Teacher is already assigned to this exam');
        return;
      }

      const { error } = await supabase
        .from('exam_teacher_assignments')
        .insert({
          exam_id: examId,
          teacher_id: teacherId,
          assigned_questions: [1, 2, 3, 4, 5], // Default questions
          marks_per_question: { "1": 20, "2": 20, "3": 20, "4": 20, "5": 20 } // Default marks
        });

      if (error) throw error;

      setTeacherAssignments(prev => ({
        ...prev,
        [examId]: teacherId
      }));

      // Refresh exams to show updated assignments
      refetch();

      toast.success('Teacher assigned successfully! They will see this exam in their dashboard.');
    } catch (error) {
      console.error('Error assigning teacher:', error);
      toast.error('Failed to assign teacher');
    }
  };

  const handleExamAdded = () => {
    refetch();
    setIsAddExamOpen(false);
  };

  const handleEditExam = (examId: string) => {
    setSelectedExamId(examId);
    setIsEditExamOpen(true);
  };

  const handleExamUpdated = () => {
    refetch();
    setIsEditExamOpen(false);
    setSelectedExamId(null);
  };

  const handleManageStudents = (exam: any) => {
    setSelectedExamForStudents(exam);
    setIsStudentAssignmentOpen(true);
  };

  if (deptLoading || teachersLoading || subjectsLoading || examsLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-2">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage exams, teachers, and students</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsAddExamOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Exam
          </Button>
          <Button onClick={() => setIsEnrollmentDialogOpen(true)} variant="outline">
            <Users className="h-4 w-4 mr-2" />
            Enroll Students
          </Button>
          <Button onClick={() => setActiveTab('files')} variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Manage Files
          </Button>
        </div>
      </div>

      <AddExamDialog isOpen={isAddExamOpen} onOpenChange={setIsAddExamOpen} onExamAdded={handleExamAdded} />
      <EditExamDialog 
        isOpen={isEditExamOpen} 
        onOpenChange={setIsEditExamOpen} 
        examId={selectedExamId}
        onExamUpdated={handleExamUpdated}
      />
      <ExamStudentAssignmentDialog 
        isOpen={isStudentAssignmentOpen}
        onOpenChange={setIsStudentAssignmentOpen}
        examId={selectedExamForStudents?.id || ''}
        examDetails={selectedExamForStudents}
      />
      <ExamEnrollmentDialog 
        isOpen={isEnrollmentDialogOpen}
        onOpenChange={setIsEnrollmentDialogOpen}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="teachers">Teachers</TabsTrigger>
          <TabsTrigger value="exams">Exams</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Departments</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{departments.length}</div>
                <p className="text-xs text-muted-foreground">
                  Active departments
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Teachers</CardTitle>
                <GraduationCap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{teachers.length}</div>
                <p className="text-xs text-muted-foreground">
                  Registered teachers
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Subjects</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{subjects.length}</div>
                <p className="text-xs text-muted-foreground">
                  Available subjects
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Exams</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{exams.length}</div>
                <p className="text-xs text-muted-foreground">
                  Scheduled exams
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Recent Exams</CardTitle>
                <CardDescription>Latest scheduled examinations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {exams.slice(0, 5).map((exam) => (
                  <div key={exam.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{exam.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {exam.subject?.name} - {exam.subject?.department?.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(exam.exam_date).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant={exam.status === 'scheduled' ? 'default' : 'secondary'}>
                      {exam.status}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Teacher Assignments</CardTitle>
                <CardDescription>Recent teacher-exam assignments</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {exams.slice(0, 5).map((exam) => (
                  <div key={exam.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{exam.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Teachers: {exam.exam_teacher_assignments?.length || 0} assigned
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {exam.exam_teacher_assignments?.map((assignment, index) => (
                        <Badge key={index} variant="outline">
                          {assignment.teacher?.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="departments" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Department Management</h2>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Department
            </Button>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {departments.map((dept) => (
              <Card key={dept.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{dept.name}</CardTitle>
                  <CardDescription>Code: {dept.code}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Teachers: {teachers.filter(t => t.department === dept.name).length}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Subjects: {subjects.filter(s => s.department_name === dept.name).length}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="teachers" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Teacher Management</h2>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Teacher
            </Button>
          </div>
          
          <div className="grid gap-4">
            {teachers.map((teacher) => (
              <Card key={teacher.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{teacher.name}</CardTitle>
                  <CardDescription>{teacher.email}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <div>
                      <Badge variant="outline">{teacher.department}</Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">Edit</Button>
                      <Button variant="outline" size="sm">View Assignments</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="exams" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Exam Management</h2>
          </div>
          
          <div className="grid gap-4">
            {exams.map((exam) => (
              <Card key={exam.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{exam.name}</CardTitle>
                  <CardDescription>
                    {exam.subject?.name} - {exam.subject?.department?.name}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Date</p>
                      <p className="font-medium">{new Date(exam.exam_date).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Duration</p>
                      <p className="font-medium">{exam.duration_minutes} minutes</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Marks</p>
                      <p className="font-medium">{exam.total_marks}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Status</p>
                      <Badge variant={exam.status === 'scheduled' ? 'default' : 'secondary'}>
                        {exam.status}
                      </Badge>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Assigned Teachers:</p>
                    <div className="flex flex-wrap gap-2">
                      {exam.exam_teacher_assignments?.map((assignment, index) => (
                        <Badge key={index} variant="outline">
                          {assignment.teacher?.name}
                          <span className="ml-1 text-xs">
                            (Q: {assignment.assigned_questions?.join(', ')})
                          </span>
                        </Badge>
                      ))}
                      {(!exam.exam_teacher_assignments || exam.exam_teacher_assignments.length === 0) && (
                        <p className="text-sm text-muted-foreground">No teachers assigned</p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => handleEditExam(exam.id)}>
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleManageStudents(exam)}>
                      <Users className="h-4 w-4 mr-1" />
                      Manage Students
                    </Button>
                    <Select 
                      value={teacherAssignments[exam.id] || ''} 
                      onValueChange={(value) => assignTeacher(exam.id, value)}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Assign Teacher" />
                      </SelectTrigger>
                      <SelectContent>
                        {teachers.map((teacher) => (
                          <SelectItem key={teacher.id} value={teacher.id}>
                            {teacher.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="files" className="space-y-4">
          <FileUploadManager />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboard;
