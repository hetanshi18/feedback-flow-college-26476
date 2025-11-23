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
        <DialogHeader className="bg-gradient-to-r from-academic-blue/10 via-purple/10 to-info/10 -mx-6 -mt-6 px-6 pt-6 pb-4 rounded-t-lg border-b border-academic-blue/20">
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-academic-blue to-purple bg-clip-text text-transparent">
            Exam Enrollment Management
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {preselectedExamId ? 'Enroll students and upload their answer sheets for the selected exam' : 'Select an exam, enroll students, and upload their answer sheets'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Exam Selection - only show if no preselected exam */}
          {!preselectedExamId && (
            <div className="space-y-2 p-4 rounded-lg bg-gradient-to-r from-academic-blue/5 to-purple/5 border-2 border-academic-blue/20">
              <Label htmlFor="exam-select" className="text-academic-navy dark:text-academic-blue font-semibold text-base">
                Select Exam
              </Label>
              <Select value={selectedExamId} onValueChange={setSelectedExamId}>
                <SelectTrigger className="border-2 border-academic-blue/30 focus:border-academic-blue focus:ring-academic-blue/20">
                  <SelectValue placeholder="Choose an existing exam" />
                </SelectTrigger>
                <SelectContent>
                  {exams.map((exam) => (
                    <SelectItem key={exam.id} value={exam.id} className="hover:bg-academic-blue/10">
                      {exam.name} - {exam.subject?.name} ({exam.subject?.department?.name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedExam && (
            <Card className="border-2 border-academic-blue/30 shadow-lg bg-gradient-to-br from-card to-academic-light/50">
              <CardHeader className="bg-gradient-to-r from-academic-blue/10 to-info/10 border-b border-academic-blue/20">
                <CardTitle className="text-xl font-bold text-academic-navy dark:text-academic-blue flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-academic-blue"></div>
                  Exam Details
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="p-3 rounded-lg bg-purple/10 border border-purple/20">
                    <span className="font-semibold text-purple dark:text-purple-foreground block mb-1">Subject:</span>
                    <p className="text-foreground">{selectedExam.subject?.name}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-teal/10 border border-teal/20">
                    <span className="font-semibold text-teal dark:text-teal-foreground block mb-1">Department:</span>
                    <p className="text-foreground">{selectedExam.subject?.department?.name}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-info/10 border border-info/20">
                    <span className="font-semibold text-info dark:text-info-foreground block mb-1">Date:</span>
                    <p className="text-foreground">{new Date(selectedExam.exam_date).toLocaleDateString()}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-academic-gold/20 border border-academic-gold/30">
                    <span className="font-semibold text-academic-gold block mb-1">Total Marks:</span>
                    <p className="text-foreground font-bold">{selectedExam.total_marks}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {selectedExamId && (
            <Tabs defaultValue="enrollment" className="space-y-4">
              <TabsList className="bg-academic-light dark:bg-academic-navy/30 border-2 border-academic-blue/20">
                <TabsTrigger value="enrollment" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-academic-blue data-[state=active]:to-purple data-[state=active]:text-white data-[state=active]:font-semibold">
                  Student Enrollment
                </TabsTrigger>
                <TabsTrigger value="upload" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-teal data-[state=active]:to-info data-[state=active]:text-white data-[state=active]:font-semibold">
                  Answer Sheet Upload
                </TabsTrigger>
              </TabsList>

              <TabsContent value="enrollment" className="space-y-4">
                {/* Add Students */}
                <div className="flex space-x-2 p-4 rounded-lg bg-gradient-to-r from-purple/5 to-academic-blue/5 border-2 border-purple/20">
                  <div className="flex-1">
                    <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                      <SelectTrigger className="border-2 border-purple/30 focus:border-purple focus:ring-purple/20">
                        <SelectValue placeholder="Select student to add" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableStudents.map((student) => (
                          <SelectItem key={student.id} value={student.id} className="hover:bg-purple/10">
                            {student.name} ({student.student_id}) - {student.email} ({student.department})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleAddStudent}
                    className="bg-academic-navy text-white hover:bg-academic-navy/90 font-semibold shadow-lg"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Student
                  </Button>
                </div>

                {/* Enrolled Students */}
                {enrolledStudents.length > 0 && (
                  <div className="border-2 border-academic-blue/20 rounded-lg overflow-hidden shadow-md bg-card">
                    <Table>
                      <TableHeader className="bg-gradient-to-r from-academic-blue/20 to-purple/20">
                        <TableRow className="border-academic-blue/30">
                          <TableHead className="font-bold text-academic-navy dark:text-academic-blue">Name</TableHead>
                          <TableHead className="font-bold text-academic-navy dark:text-academic-blue">Email</TableHead>
                          <TableHead className="font-bold text-academic-navy dark:text-academic-blue">Department</TableHead>
                          <TableHead className="font-bold text-academic-navy dark:text-academic-blue">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {enrolledStudents.map((student, index) => (
                          <TableRow
                            key={student.id}
                            className={`border-academic-blue/10 ${index % 2 === 0 ? 'bg-academic-light/30 dark:bg-academic-navy/10' : 'bg-card'}`}
                          >
                            <TableCell className="font-medium text-foreground">{student.name}</TableCell>
                            <TableCell className="text-muted-foreground">{student.email}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="bg-academic-navy/20 text-academic-navy border-academic-navy/30">
                                {student.department}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRemoveStudent(student.id)}
                                className="border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
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
                  <Badge className="bg-academic-navy/20 text-academic-navy border-academic-navy/30 px-4 py-2 text-sm font-semibold shadow-md">
                    {enrolledStudents.length} {enrolledStudents.length === 1 ? 'student' : 'students'} enrolled
                  </Badge>
                  <Button
                    onClick={handleSaveEnrollment}
                    className="bg-academic-navy text-white hover:bg-academic-navy/90 font-semibold shadow-lg"
                  >
                    Save Enrollment
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="upload" className="space-y-4">
                {enrolledStudents.length === 0 ? (
                  <div className="text-center py-12 px-4 rounded-lg bg-gradient-to-br from-warning/10 to-academic-gold/10 border-2 border-warning/20">
                    <p className="text-warning font-semibold text-lg mb-2">
                      No Students Enrolled Yet
                    </p>
                    <p className="text-muted-foreground">
                      Please enroll students first to upload answer sheets
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="border-2 border-teal/20 rounded-lg overflow-hidden shadow-md bg-card">
                      <Table>
                        <TableHeader className="bg-gradient-to-r from-teal/20 to-info/20">
                          <TableRow className="border-teal/30">
                            <TableHead className="font-bold text-academic-navy dark:text-academic-blue">Student Name</TableHead>
                            <TableHead className="font-bold text-academic-navy dark:text-academic-blue">Answer Sheet</TableHead>
                            <TableHead className="font-bold text-academic-navy dark:text-academic-blue">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {enrolledStudents.map((student, index) => (
                            <TableRow
                              key={student.id}
                              className={`border-teal/10 ${index % 2 === 0 ? 'bg-academic-light/30 dark:bg-academic-navy/10' : 'bg-card'}`}
                            >
                              <TableCell className="font-medium text-foreground">{student.name}</TableCell>
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
                                  className="max-w-[200px] border-info/30 focus:border-info focus:ring-info/20"
                                />
                              </TableCell>
                              <TableCell>
                                {answerSheetUploads[student.id] ? (
                                  <Badge className="bg-academic-navy/20 text-academic-navy border-academic-navy/30 shadow-sm">
                                    <FileText className="h-3 w-3 mr-1" />
                                    Uploaded
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="border-academic-navy/30 text-academic-navy bg-academic-navy/20">
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
                      <Badge className="bg-academic-navy/20 text-academic-navy border-academic-navy/30 px-4 py-2 text-sm font-semibold shadow-md">
                        {Object.keys(answerSheetUploads).length} of {enrolledStudents.length} uploaded
                      </Badge>
                      <Button
                        onClick={handleBulkUpload}
                        className="bg-academic-navy text-white hover:bg-academic-navy/90 font-semibold shadow-lg"
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