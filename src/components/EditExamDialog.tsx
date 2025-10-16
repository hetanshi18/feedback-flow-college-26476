import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useSubjects } from '@/hooks/useDatabase';
import { Upload } from 'lucide-react';

interface EditExamDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  examId: string | null;
  onExamUpdated: () => void;
}

const EditExamDialog = ({ isOpen, onOpenChange, examId, onExamUpdated }: EditExamDialogProps) => {
  const [formData, setFormData] = useState({
    name: '',
    subjectId: '',
    examDate: '',
    startTime: '',
    durationMinutes: '',
    totalMarks: '',
    instructions: '',
    status: 'scheduled'
  });
  const [questionPaper, setQuestionPaper] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  
  const { subjects } = useSubjects();

  useEffect(() => {
    if (examId && isOpen) {
      fetchExamDetails();
    }
  }, [examId, isOpen]);

  const fetchExamDetails = async () => {
    if (!examId) return;
    
    try {
      const { data, error } = await supabase
        .from('exams')
        .select('*')
        .eq('id', examId)
        .single();

      if (error) throw error;

      setFormData({
        name: data.name || '',
        subjectId: data.subject_id || '',
        examDate: data.exam_date || '',
        startTime: data.start_time || '',
        durationMinutes: data.duration_minutes?.toString() || '',
        totalMarks: data.total_marks?.toString() || '',
        instructions: data.instructions || '',
        status: data.status || 'scheduled'
      });
    } catch (error) {
      console.error('Error fetching exam details:', error);
      toast.error('Failed to load exam details');
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast.error('Please upload a PDF file');
        return;
      }
      setQuestionPaper(file);
    }
  };

  const handleSubmit = async () => {
    if (!examId || !formData.name || !formData.subjectId || !formData.examDate || !formData.startTime) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      let questionPaperUrl = null;
      
      // Upload question paper if provided
      if (questionPaper) {
        const fileExt = questionPaper.name.split('.').pop();
        const fileName = `question-paper-${examId}-${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('answer-sheets')
          .upload(fileName, questionPaper);

        if (uploadError) throw uploadError;
        questionPaperUrl = uploadData.path;
      }

      // Update exam
      const updateData: any = {
        name: formData.name,
        subject_id: formData.subjectId,
        exam_date: formData.examDate,
        start_time: formData.startTime,
        duration_minutes: parseInt(formData.durationMinutes),
        total_marks: parseInt(formData.totalMarks),
        instructions: formData.instructions,
        status: formData.status,
        updated_at: new Date().toISOString()
      };

      if (questionPaperUrl) {
        updateData.question_paper_url = questionPaperUrl;
      }

      const { error } = await supabase
        .from('exams')
        .update(updateData)
        .eq('id', examId);

      if (error) throw error;

      toast.success('Exam updated successfully!');
      onExamUpdated();
      onOpenChange(false);
      
      // Reset form
      setFormData({
        name: '',
        subjectId: '',
        examDate: '',
        startTime: '',
        durationMinutes: '',
        totalMarks: '',
        instructions: '',
        status: 'scheduled'
      });
      setQuestionPaper(null);
    } catch (error) {
      console.error('Error updating exam:', error);
      toast.error('Failed to update exam');
    } finally {
      setLoading(false);
    }
  };

  const selectedSubject = subjects.find(s => s.id === formData.subjectId);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Exam</DialogTitle>
          <DialogDescription>
            Update exam details and upload question paper
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Exam Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter exam name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Select value={formData.subjectId} onValueChange={(value) => handleInputChange('subjectId', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.name} ({subject.code}) - {subject.department_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="examDate">Exam Date</Label>
              <Input
                id="examDate"
                type="date"
                value={formData.examDate}
                onChange={(e) => handleInputChange('examDate', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                id="startTime"
                type="time"
                value={formData.startTime}
                onChange={(e) => handleInputChange('startTime', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                value={formData.durationMinutes}
                onChange={(e) => handleInputChange('durationMinutes', e.target.value)}
                placeholder="180"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="totalMarks">Total Marks</Label>
              <Input
                id="totalMarks"
                type="number"
                value={formData.totalMarks}
                onChange={(e) => handleInputChange('totalMarks', e.target.value)}
                placeholder="100"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="ongoing">Ongoing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="instructions">Instructions</Label>
            <Textarea
              id="instructions"
              value={formData.instructions}
              onChange={(e) => handleInputChange('instructions', e.target.value)}
              placeholder="Enter exam instructions..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="questionPaper">Question Paper (PDF)</Label>
            <div className="flex items-center space-x-2">
              <Input
                id="questionPaper"
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="cursor-pointer"
              />
              <Upload className="h-5 w-5 text-muted-foreground" />
            </div>
            {questionPaper && (
              <p className="text-sm text-muted-foreground">
                Selected: {questionPaper.name}
              </p>
            )}
          </div>

          {selectedSubject && (
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Exam Details</h4>
              <p className="text-sm text-muted-foreground">Subject: {selectedSubject.name}</p>
              <p className="text-sm text-muted-foreground">Department: {selectedSubject.department_name}</p>
              <p className="text-sm text-muted-foreground">Semester: {selectedSubject.semester_name}</p>
              <p className="text-sm text-muted-foreground">Credits: {selectedSubject.credits}</p>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? 'Updating...' : 'Update Exam'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditExamDialog;