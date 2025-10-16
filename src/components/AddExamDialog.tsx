
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Upload, X, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Exam, ExamTeacherAssignment } from '@/types';
import { useDepartments, useTeachers, useSubjects } from '@/hooks/useDatabase';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface AddExamDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onExamAdded?: () => void;
}

const AddExamDialog = ({ isOpen, onOpenChange, onExamAdded }: AddExamDialogProps) => {
  const [examData, setExamData] = useState({
    name: '',
    subject_id: '',
    date: '',
    start_time: '',
    duration: '',
    totalMarks: '',
    totalQuestions: '',
    instructions: ''
  });

  // Fetch real data from database
  const { departments } = useDepartments();
  const { teachers } = useTeachers();
  const { subjects } = useSubjects();
  
  // Get current user for created_by field
  const { user } = useAuth();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  useState(() => {
    const fetchCurrentUser = async () => {
      if (user?.id) {
        // Get current admin ID for created_by field
        const { data } = await supabase.rpc('get_current_user_details');
        
        if (data?.[0]?.record_id) {
          setCurrentUserId(data[0].record_id);
        }
      }
    };
    fetchCurrentUser();
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [teacherAssignments, setTeacherAssignments] = useState<ExamTeacherAssignment[]>([]);
  const [currentTeacher, setCurrentTeacher] = useState('');
  const [currentQuestions, setCurrentQuestions] = useState('');
  const [currentMarks, setCurrentMarks] = useState('');

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        setSelectedFile(file);
        toast.success('Question paper uploaded successfully');
      } else {
        toast.error('Please upload a PDF file');
      }
    }
  };

  const addTeacherAssignment = () => {
    if (!currentTeacher || !currentQuestions || !currentMarks) {
      toast.error('Please fill in all teacher assignment fields');
      return;
    }

    const teacher = teachers.find(t => t.id === currentTeacher);
    if (!teacher) return;

    const questions = currentQuestions.split(',').map(q => parseInt(q.trim())).filter(q => !isNaN(q));

    // Optional: Validate within totalQuestions if provided
    const totalQ = parseInt(examData.totalQuestions);
    if (!isNaN(totalQ) && questions.some(q => q < 1 || q > totalQ)) {
      toast.error(`Questions must be between 1 and ${totalQ}`);
      return;
    }
    const marksPerQuestion: Record<number, number> = {};
    
    const marksArray = currentMarks.split(',').map(m => parseInt(m.trim())).filter(m => !isNaN(m));
    
    if (questions.length !== marksArray.length) {
      toast.error('Number of questions must match number of marks');
      return;
    }

    questions.forEach((q, index) => {
      marksPerQuestion[q] = marksArray[index];
    });

    // Validate total marks sum across all assignments does not exceed exam total
    const assignmentSum = questions.reduce((s, q, i) => s + (marksArray[i] || 0), 0);
    const currentSum = teacherAssignments.reduce((sum, a) => sum + a.assignedQuestions.reduce((s, q) => s + (a.marksPerQuestion[q] || 0), 0), 0);
    const grand = assignmentSum + currentSum;
    const examTotal = parseInt(examData.totalMarks);
    if (!isNaN(examTotal) && grand > examTotal) {
      toast.error('Assigned marks exceed exam total marks');
      return;
    }

    const newAssignment: ExamTeacherAssignment = {
      teacherId: teacher.id,
      teacherName: teacher.name,
      assignedQuestions: questions,
      marksPerQuestion
    };

    setTeacherAssignments([...teacherAssignments, newAssignment]);
    setCurrentTeacher('');
    setCurrentQuestions('');
    setCurrentMarks('');
    toast.success(`${teacher.name} assigned to questions ${questions.join(', ')}`);
  };

  const removeTeacherAssignment = (index: number) => {
    setTeacherAssignments(teacherAssignments.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!examData.name || !examData.subject_id || !examData.date || !examData.start_time || 
        !examData.duration || !examData.totalMarks || !examData.totalQuestions) {
      toast.error('Please fill in all exam details');
      return;
    }

    if (teacherAssignments.length === 0) {
      toast.error('Please assign at least one teacher');
      return;
    }

    try {
      // Check if we have a valid user ID
      if (!currentUserId) {
        toast.error('Unable to identify current user. Please try logging in again.');
        return;
      }

      // Create exam
      const { data: exam, error: examError } = await supabase
        .from('exams')
        .insert({
          name: examData.name,
          subject_id: examData.subject_id,
          exam_date: examData.date,
          start_time: examData.start_time,
          duration_minutes: parseInt(examData.duration),
          total_marks: parseInt(examData.totalMarks),
          total_questions: parseInt(examData.totalQuestions),
          instructions: examData.instructions,
          status: 'scheduled',
          created_by: currentUserId
        })
        .select()
        .single();

      if (examError) throw examError;

      // Create teacher assignments
      const assignments = teacherAssignments.map(assignment => ({
        exam_id: exam.id,
        teacher_id: assignment.teacherId,
        assigned_questions: assignment.assignedQuestions,
        marks_per_question: assignment.marksPerQuestion
      }));

      const { error: assignmentError } = await supabase
        .from('exam_teacher_assignments')
        .insert(assignments);

      if (assignmentError) throw assignmentError;

      toast.success('Exam created successfully');
      
      // Reset form
      setExamData({
        name: '',
        subject_id: '',
        date: '',
        start_time: '',
        duration: '',
        totalMarks: '',
        totalQuestions: '',
        instructions: ''
      });
      setSelectedFile(null);
      setTeacherAssignments([]);
      
      // Call the onExamAdded callback if provided
      if (onExamAdded) {
        onExamAdded();
      }
      
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating exam:', error);
      toast.error('Failed to create exam');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Exam</DialogTitle>
          <DialogDescription>
            Set up a new exam with teacher assignments and question paper
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Exam Details */}
          <Card>
            <CardHeader>
              <CardTitle>Exam Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="examName">Exam Name</Label>
                  <Input
                    id="examName"
                    value={examData.name}
                    onChange={(e) => setExamData({ ...examData, name: e.target.value })}
                    placeholder="End Semester Examination"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Select value={examData.subject_id} onValueChange={(value) => setExamData({ ...examData, subject_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((subject) => (
                        <SelectItem key={subject.id} value={subject.id}>
                          {subject.name} ({subject.department_name})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startTime">Start Time</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={examData.start_time}
                    onChange={(e) => setExamData({ ...examData, start_time: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instructions">Instructions</Label>
                  <Textarea
                    id="instructions"
                    value={examData.instructions}
                    onChange={(e) => setExamData({ ...examData, instructions: e.target.value })}
                    placeholder="Additional exam instructions"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="examDate">Exam Date</Label>
                  <Input
                    id="examDate"
                    type="date"
                    value={examData.date}
                    onChange={(e) => setExamData({ ...examData, date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={examData.duration}
                    onChange={(e) => setExamData({ ...examData, duration: e.target.value })}
                    placeholder="180"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="totalMarks">Total Marks</Label>
                  <Input
                    id="totalMarks"
                    type="number"
                    value={examData.totalMarks}
                    onChange={(e) => setExamData({ ...examData, totalMarks: e.target.value })}
                    placeholder="100"
                  />
                </div>
                <div className="space-y-2 col-span-3">
                  <Label htmlFor="totalQuestions">Total Questions</Label>
                  <Input
                    id="totalQuestions"
                    type="number"
                    value={examData.totalQuestions}
                    onChange={(e) => setExamData({ ...examData, totalQuestions: e.target.value })}
                    placeholder="e.g. 10"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Question Paper Upload */}
          <Card>
            <CardHeader>
              <CardTitle>Question Paper</CardTitle>
              <CardDescription>Upload the question paper (PDF only)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <Label htmlFor="questionPaper" className="cursor-pointer">
                    <div className="flex items-center space-x-2 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-md border border-blue-200">
                      <Upload className="h-4 w-4" />
                      <span>Upload Question Paper</span>
                    </div>
                  </Label>
                  <Input
                    id="questionPaper"
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
                {selectedFile && (
                  <div className="flex items-center space-x-2 p-2 bg-green-50 border border-green-200 rounded-md">
                    <FileText className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-green-700">{selectedFile.name}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Teacher Assignments */}
          <Card>
            <CardHeader>
              <CardTitle>Teacher Assignments</CardTitle>
              <CardDescription>Assign teachers to specific question numbers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Teacher</Label>
                  <Select value={currentTeacher} onValueChange={setCurrentTeacher}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select teacher" />
                    </SelectTrigger>
                    <SelectContent>
                      {teachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          {teacher.name} ({teacher.department})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Question Numbers</Label>
                  <Input
                    value={currentQuestions}
                    onChange={(e) => setCurrentQuestions(e.target.value)}
                    placeholder="1,2,3"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Marks per Question</Label>
                  <Input
                    value={currentMarks}
                    onChange={(e) => setCurrentMarks(e.target.value)}
                    placeholder="20,15,25"
                  />
                </div>
                <div className="space-y-2">
                  <Label>&nbsp;</Label>
                  <Button onClick={addTeacherAssignment} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </div>
              </div>

              {/* Current Assignments */}
              {teacherAssignments.length > 0 && (
                <div className="space-y-2">
                  <Label>Current Assignments:</Label>
                  <div className="space-y-2">
                    {teacherAssignments.map((assignment, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                        <div>
                          <span className="font-medium">{assignment.teacherName}</span>
                          <div className="text-sm text-gray-600">
                            Questions: {assignment.assignedQuestions.join(', ')} 
                            {' | '}
                            Marks: {assignment.assignedQuestions.map(q => assignment.marksPerQuestion[q]).join(', ')}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeTeacherAssignment(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              Create Exam
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddExamDialog;
