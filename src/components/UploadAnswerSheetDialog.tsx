import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useExams } from '@/hooks/useDatabase';

interface UploadAnswerSheetDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const UploadAnswerSheetDialog = ({ isOpen, onOpenChange }: UploadAnswerSheetDialogProps) => {
  const [formData, setFormData] = useState({
    studentId: '',
    examId: '',
    file: null as File | null,
  });
  const [students, setStudents] = useState<any[]>([]);
  
  const { exams } = useExams();

  useEffect(() => {
    const fetchStudents = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student');
      if (data) setStudents(data);
    };
    fetchStudents();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast.error('Please upload a PDF file');
        return;
      }
      setFormData(prev => ({ ...prev, file }));
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async () => {
    if (!formData.studentId || !formData.examId || !formData.file) {
      toast.error('Please fill in all fields and upload a file');
      return;
    }

    try {
      // Upload file to Supabase storage
      const fileExt = formData.file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('answer-sheets')
        .upload(fileName, formData.file);

      if (uploadError) throw uploadError;

      // Save answer sheet record
      const selectedExam = exams.find(e => e.id === formData.examId);
      const { error: insertError } = await supabase
        .from('answer_sheets')
        .insert({
          exam_id: formData.examId,
          student_id: formData.studentId,
          file_url: uploadData.path,
          total_marks: selectedExam?.total_marks || 100
        });

      if (insertError) throw insertError;

      toast.success('Answer sheet uploaded successfully!');
      
      // Reset form
      setFormData({
        studentId: '',
        examId: '',
        file: null,
      });
      
      onOpenChange(false);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload answer sheet');
    }
  };

  const selectedStudent = students.find(s => s.id === formData.studentId);
  const selectedExam = exams.find(e => e.id === formData.examId);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Answer Sheet</DialogTitle>
          <DialogDescription>
            Select a student, exam, and upload their answer sheet
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="student">Select Student</Label>
              <Select value={formData.studentId} onValueChange={(value) => handleInputChange('studentId', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a student" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.name} - {student.department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedStudent && (
                <p className="text-sm text-muted-foreground">
                  Email: {selectedStudent.email}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="exam">Exam</Label>
              <Select value={formData.examId} onValueChange={(value) => handleInputChange('examId', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an exam" />
                </SelectTrigger>
                <SelectContent>
                  {exams.map((exam) => (
                    <SelectItem key={exam.id} value={exam.id}>
                      {exam.name} - {exam.subject?.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedStudent && selectedExam && (
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Upload Details</h4>
              <p className="text-sm text-muted-foreground">Student: {selectedStudent.name}</p>
              <p className="text-sm text-muted-foreground">Exam: {selectedExam.name}</p>
              <p className="text-sm text-muted-foreground">Subject: {selectedExam.subject?.name}</p>
              <p className="text-sm text-muted-foreground">Total Marks: {selectedExam.total_marks}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="file">Answer Sheet (PDF)</Label>
            <div className="flex items-center space-x-2">
              <Input
                id="file"
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="cursor-pointer"
              />
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            {formData.file && (
              <p className="text-sm text-muted-foreground">
                Selected: {formData.file.name}
              </p>
            )}
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Answer Sheet
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UploadAnswerSheetDialog;