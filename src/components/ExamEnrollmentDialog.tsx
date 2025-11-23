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
import { UserPlus, Upload, X, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useExams } from '@/hooks/useDatabase';
import { supabase } from '@/integrations/supabase/client';

interface ExamEnrollmentDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedExamId?: string;
}

const ExamEnrollmentDialog = ({ isOpen, onOpenChange, preselectedExamId }: ExamEnrollmentDialogProps) => {
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [answerSheetUploads, setAnswerSheetUploads] = useState<Record<string, File>>({});

  const { exams, loading: examsLoading } = useExams();

  useEffect(() => {
    if (isOpen && preselectedExamId) {
      setSelectedExamId(preselectedExamId);
    }
  }, [isOpen, preselectedExamId]);

  useEffect(() => {
    if (isOpen) {
      const fetchStudents = async () => {
        const { data } = await supabase
          .from('students')
          .select('*');
        if (data) setStudents(data);
      };
      fetchStudents();

      // Fetch already enrolled students if exam is selected
      if (selectedExamId) {
        fetchEnrolledStudents();
      }
    }
  }, [isOpen, selectedExamId]);

  const fetchEnrolledStudents = async () => {
    if (!selectedExamId) return;

    const { data } = await supabase
      .from('exam_enrollments')
      .select(`
        *,
        student:students!exam_enrollments_student_id_fkey(*)
      `)
      .eq('exam_id', selectedExamId);

    if (data) {
      setEnrolledStudents(data.map(enrollment => enrollment.student).filter(Boolean));
    }
  };

  const selectedExam = exams.find(exam => exam.id === selectedExamId);
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
            exam_id: selectedExamId,
            student_id: selectedStudentId
          });

        if (error) throw error;

        setEnrolledStudents([...enrolledStudents, student]);
        setSelectedStudentId('');
        toast.success(`${student.name} added to exam`);
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
        .eq('exam_id', selectedExamId)
        .eq('student_id', studentId);

      if (error) throw error;

      const student = enrolledStudents.find(s => s.id === studentId);
      setEnrolledStudents(enrolledStudents.filter(s => s.id !== studentId));

      // Remove answer sheet if uploaded
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

  const handleSaveEnrollment = () => {
    if (!selectedExamId) {
      toast.error('Please select an exam');
      return;
    }

    if (enrolledStudents.length === 0) {
      toast.error('Please add at least one student');
      return;
    }

    toast.success(`Enrollment saved for ${enrolledStudents.length} students`);
    onOpenChange(false);
  };

  const handleBulkUpload = async () => {
    const uploadedCount = Object.keys(answerSheetUploads).length;
    if (uploadedCount === 0) {
      toast.error('No answer sheets uploaded');
      return;
    }

    try {
      // Upload all files and create answer sheet records
      for (const [studentId, file] of Object.entries(answerSheetUploads)) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${studentId}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('answer-sheets')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { error: insertError } = await supabase
          .from('answer_sheets')
          .insert({
            exam_id: selectedExamId,
            student_id: studentId,
            file_url: uploadData.path,
            total_marks: selectedExam?.total_marks || 100
          });

        if (insertError) throw insertError;
      }

      toast.success(`${uploadedCount} answer sheets uploaded successfully`);
      setAnswerSheetUploads({});
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload some answer sheets');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            Exam Enrollment Management
          </DialogTitle>
          <DialogDescription>
            {preselectedExamId ? 'Enroll students and upload their answer sheets for the selected exam' : 'Select an exam, enroll students, and upload their answer sheets'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Exam Selection - only show if no preselected exam */}
          {!preselectedExamId && (
            <div className="space-y-2">
              <Label htmlFor="exam-select" className="font-semibold text-base">
                Select Exam
              </Label>
              <Select value={selectedExamId} onValueChange={setSelectedExamId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an existing exam" />
                </SelectTrigger>
                <SelectContent>
                  {exams.map((exam) => (
                    <SelectItem key={exam.id} value={exam.id}>
                      {exam.name} - {exam.subject?.name} ({exam.subject?.department?.name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedExam && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-bold">
                  Exam Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="p-3 rounded-lg bg-muted/50 border">
                    <span className="font-semibold text-muted-foreground block mb-1">Subject:</span>
                    <p className="text-foreground">{selectedExam.subject?.name}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border">
                    <span className="font-semibold text-muted-foreground block mb-1">Department:</span>
                    <p className="text-foreground">{selectedExam.subject?.department?.name}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border">
                    <span className="font-semibold text-muted-foreground block mb-1">Date:</span>
                    <p className="text-foreground">{new Date(selectedExam.exam_date).toLocaleDateString()}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border">
                    <span className="font-semibold text-muted-foreground block mb-1">Total Marks:</span>
                    <p className="text-foreground font-bold">{selectedExam.total_marks}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {selectedExamId && (
            <Tabs defaultValue="enrollment" className="space-y-4">
              <TabsList>
                <TabsTrigger value="enrollment">
                  Student Enrollment
                </TabsTrigger>
                <TabsTrigger value="upload">
                  Answer Sheet Upload
                </TabsTrigger>
              </TabsList>

              <TabsContent value="enrollment" className="space-y-4">
                {/* Add Students */}
                <div className="flex space-x-2">
                  <div className="flex-1">
                    <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select student to add" />
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
                  <Button
                    onClick={handleAddStudent}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Student
                  </Button>
                </div>

                {/* Enrolled Students */}
                {enrolledStudents.length > 0 && (
                  <div className="rounded-lg overflow-hidden border">
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
                            <TableCell className="text-muted-foreground">{student.email}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {student.department}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRemoveStudent(student.id)}
                                className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
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

                <div className="flex justify-between items-center">
                  <Badge variant="secondary" className="px-4 py-2 text-sm font-semibold">
                    {enrolledStudents.length} {enrolledStudents.length === 1 ? 'student' : 'students'} enrolled
                  </Badge>
                  <Button
                    onClick={handleSaveEnrollment}
                  >
                    Save Enrollment
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="upload" className="space-y-4">
                {enrolledStudents.length === 0 ? (
                  <div className="text-center py-12 px-4 rounded-lg border bg-muted/50">
                    <p className="font-semibold text-lg mb-2">
                      No Students Enrolled Yet
                    </p>
                    <p className="text-muted-foreground">
                      Please enroll students first to upload answer sheets
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-lg overflow-hidden border">
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
                                  <Badge>
                                    <FileText className="h-3 w-3 mr-1" />
                                    Uploaded
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">
                                    Pending
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="flex justify-between items-center">
                      <Badge variant="secondary" className="px-4 py-2 text-sm font-semibold">
                        {Object.keys(answerSheetUploads).length} of {enrolledStudents.length} uploaded
                      </Badge>
                      <Button
                        onClick={handleBulkUpload}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Process All Uploads
                      </Button>
                    </div>
                  </>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExamEnrollmentDialog;