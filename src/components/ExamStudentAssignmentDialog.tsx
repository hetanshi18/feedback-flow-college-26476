import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPlus, Upload, X, FileText, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';

interface ExamStudentAssignmentDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  examId: string;
  examDetails: any;
}

const ExamStudentAssignmentDialog = ({ isOpen, onOpenChange, examId, examDetails }: ExamStudentAssignmentDialogProps) => {
  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [answerSheetUploads, setAnswerSheetUploads] = useState<Record<string, File>>({});
  const [questionPaperVisible, setQuestionPaperVisible] = useState({
    students: false,
    teachers: false
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && examId) {
      fetchStudents();
      fetchEnrolledStudents();
      fetchQuestionPaperVisibility();
    }
  }, [isOpen, examId]);

  const fetchStudents = async () => {
    const { data } = await supabase
      .from('students')
      .select('*');
    if (data) setStudents(data);
  };

  const fetchEnrolledStudents = async () => {
    const { data } = await supabase
      .from('exam_enrollments')
      .select(`
        *,
        student:students!exam_enrollments_student_id_fkey(*)
      `)
      .eq('exam_id', examId);
    
    if (data) {
      setEnrolledStudents(data.map(enrollment => enrollment.student).filter(Boolean));
    }
  };

  const fetchQuestionPaperVisibility = async () => {
    const { data } = await supabase
      .from('exams')
      .select('question_paper_visible_to_students, question_paper_visible_to_teachers')
      .eq('id', examId)
      .single();
    
    if (data) {
      setQuestionPaperVisible({
        students: data.question_paper_visible_to_students || false,
        teachers: data.question_paper_visible_to_teachers || false
      });
    }
  };

  const availableStudents = students.filter(
    student => !enrolledStudents.find(enrolled => enrolled.id === student.id)
  );

  const handleAddStudent = async () => {
    if (!selectedStudentId) {
      toast.error('Please select a student');
      return;
    }

    const student = students.find(s => s.id === selectedStudentId);
    if (student) {
      try {
        const { error } = await supabase
          .from('exam_enrollments')
          .insert({
            exam_id: examId,
            student_id: selectedStudentId
          });
        
        if (error) throw error;
        
        setEnrolledStudents([...enrolledStudents, student]);
        setSelectedStudentId('');
        toast.success(`${student.name} enrolled in exam`);
      } catch (error) {
        toast.error('Failed to enroll student');
      }
    }
  };

  const handleRemoveStudent = async (studentId: string) => {
    try {
      const { error } = await supabase
        .from('exam_enrollments')
        .delete()
        .eq('exam_id', examId)
        .eq('student_id', studentId);
      
      if (error) throw error;
      
      const student = enrolledStudents.find(s => s.id === studentId);
      setEnrolledStudents(enrolledStudents.filter(s => s.id !== studentId));
      
      if (answerSheetUploads[studentId]) {
        const newUploads = { ...answerSheetUploads };
        delete newUploads[studentId];
        setAnswerSheetUploads(newUploads);
      }
      
      if (student) {
        toast.success(`${student.name} removed from exam`);
      }
    } catch (error) {
      toast.error('Failed to remove student');
    }
  };

  const handleFileUpload = (studentId: string, file: File) => {
    if (file.type !== 'application/pdf') {
      toast.error('Please upload only PDF files');
      return;
    }

    setAnswerSheetUploads({
      ...answerSheetUploads,
      [studentId]: file
    });

    const student = enrolledStudents.find(s => s.id === studentId);
    toast.success(`Answer sheet uploaded for ${student?.name}`);
  };

  const handleBulkUpload = async () => {
    const uploadedCount = Object.keys(answerSheetUploads).length;
    if (uploadedCount === 0) {
      toast.error('No answer sheets uploaded');
      return;
    }

    setLoading(true);
    try {
      for (const [studentId, file] of Object.entries(answerSheetUploads)) {
        const fileExt = file.name.split('.').pop();
        const fileName = `answer-sheet-${examId}-${studentId}-${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('answer-sheets')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { error: insertError } = await supabase
          .from('answer_sheets')
          .insert({
            exam_id: examId,
            student_id: studentId,
            file_url: uploadData.path,
            total_marks: examDetails?.total_marks || 100
          });

        if (insertError) throw insertError;
      }

      toast.success(`${uploadedCount} answer sheets uploaded successfully`);
      setAnswerSheetUploads({});
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload some answer sheets');
    } finally {
      setLoading(false);
    }
  };

  const handleQuestionPaperVisibilityChange = async (type: 'students' | 'teachers', visible: boolean) => {
    try {
      const updateField = type === 'students' 
        ? 'question_paper_visible_to_students' 
        : 'question_paper_visible_to_teachers';
      
      const { error } = await supabase
        .from('exams')
        .update({ [updateField]: visible })
        .eq('id', examId);
      
      if (error) throw error;
      
      setQuestionPaperVisible(prev => ({
        ...prev,
        [type]: visible
      }));
      
      toast.success(`Question paper ${visible ? 'visible to' : 'hidden from'} ${type}`);
    } catch (error) {
      toast.error('Failed to update visibility settings');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Students - {examDetails?.name}</DialogTitle>
          <DialogDescription>
            Enroll students, upload answer sheets, and manage question paper visibility for this specific exam
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Exam Details */}
          <Card>
            <CardHeader>
              <CardTitle>Exam Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="font-medium">Subject:</span>
                  <p>{examDetails?.subject?.name}</p>
                </div>
                <div>
                  <span className="font-medium">Department:</span>
                  <p>{examDetails?.subject?.department?.name}</p>
                </div>
                <div>
                  <span className="font-medium">Date:</span>
                  <p>{new Date(examDetails?.exam_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <span className="font-medium">Total Marks:</span>
                  <p>{examDetails?.total_marks}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Question Paper Visibility Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Question Paper Visibility</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {questionPaperVisible.students ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  <Label htmlFor="students-visibility">Visible to Students</Label>
                </div>
                <Switch
                  id="students-visibility"
                  checked={questionPaperVisible.students}
                  onCheckedChange={(checked) => handleQuestionPaperVisibilityChange('students', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {questionPaperVisible.teachers ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  <Label htmlFor="teachers-visibility">Visible to Teachers</Label>
                </div>
                <Switch
                  id="teachers-visibility"
                  checked={questionPaperVisible.teachers}
                  onCheckedChange={(checked) => handleQuestionPaperVisibilityChange('teachers', checked)}
                />
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="enrollment" className="space-y-4">
            <TabsList>
              <TabsTrigger value="enrollment">Student Enrollment</TabsTrigger>
              <TabsTrigger value="upload">Answer Sheet Upload</TabsTrigger>
            </TabsList>

            <TabsContent value="enrollment" className="space-y-4">
              {/* Add Students */}
              <div className="flex space-x-2">
                <div className="flex-1">
                  <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select student to enroll" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableStudents.map((student) => (
                        <SelectItem key={student.id} value={student.id}>
                          {student.name} ({student.student_id}) - {student.email} ({student.department})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddStudent}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Enroll Student
                </Button>
              </div>

              {/* Enrolled Students */}
              {enrolledStudents.length > 0 && (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {enrolledStudents.map((student) => (
                        <TableRow key={student.id}>
                          <TableCell className="font-medium">{student.name}</TableCell>
                          <TableCell>{student.email}</TableCell>
                          <TableCell>{student.department}</TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRemoveStudent(student.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <Badge variant="secondary">
                {enrolledStudents.length} students enrolled
              </Badge>
            </TabsContent>

            <TabsContent value="upload" className="space-y-4">
              {enrolledStudents.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Please enroll students first to upload answer sheets
                </p>
              ) : (
                <>
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student Name</TableHead>
                          <TableHead>Answer Sheet</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {enrolledStudents.map((student) => (
                          <TableRow key={student.id}>
                            <TableCell className="font-medium">{student.name}</TableCell>
                            <TableCell>
                              <Input
                                type="file"
                                accept=".pdf"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    handleFileUpload(student.id, file);
                                  }
                                }}
                                className="max-w-[200px]"
                              />
                            </TableCell>
                            <TableCell>
                              {answerSheetUploads[student.id] ? (
                                <Badge className="bg-green-100 text-green-800 border-green-200">
                                  <FileText className="h-3 w-3 mr-1" />
                                  Uploaded
                                </Badge>
                              ) : (
                                <Badge variant="outline">Pending</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex justify-between items-center">
                    <Badge variant="secondary">
                      {Object.keys(answerSheetUploads).length} of {enrolledStudents.length} uploaded
                    </Badge>
                    <Button onClick={handleBulkUpload} disabled={loading}>
                      <Upload className="h-4 w-4 mr-2" />
                      {loading ? 'Processing...' : 'Process All Uploads'}
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExamStudentAssignmentDialog;