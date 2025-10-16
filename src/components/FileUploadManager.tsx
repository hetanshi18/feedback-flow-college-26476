import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, Trash2, Eye, Download } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useExams } from '@/hooks/useDatabase';

interface FileInfo {
  name: string;
  id: string;
  created_at: string;
  metadata?: any;
}

const FileUploadManager = () => {
  const [questionPaperFile, setQuestionPaperFile] = useState<File | null>(null);
  const [answerSheetFile, setAnswerSheetFile] = useState<File | null>(null);
  const [selectedExam, setSelectedExam] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [questionPapers, setQuestionPapers] = useState<FileInfo[]>([]);
  const [answerSheets, setAnswerSheets] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  
  const { exams } = useExams();

  // Fetch existing files and students
  useEffect(() => {
    fetchFiles();
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase.rpc('get_students_by_department');
      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const fetchFiles = async () => {
    setLoading(true);
    try {
      // Fetch question papers
      const { data: qpData, error: qpError } = await supabase.storage
        .from('question-papers')
        .list('', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });

      if (qpError) throw qpError;
      setQuestionPapers(qpData || []);

      // Fetch answer sheets
      const { data: asData, error: asError } = await supabase.storage
        .from('answer-sheets')
        .list('', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });

      if (asError) throw asError;
      setAnswerSheets(asData || []);
    } catch (error) {
      console.error('Error fetching files:', error);
      toast({ 
        title: "Error", 
        description: "Failed to fetch files", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleQuestionPaperUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'application/pdf') {
        setQuestionPaperFile(file);
      } else {
        toast({ 
          title: "Invalid file type", 
          description: "Please upload a PDF file", 
          variant: "destructive" 
        });
      }
    }
  };

  const handleAnswerSheetUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'application/pdf') {
        setAnswerSheetFile(file);
      } else {
        toast({ 
          title: "Invalid file type", 
          description: "Please upload a PDF file", 
          variant: "destructive" 
        });
      }
    }
  };

  const uploadQuestionPaper = async () => {
    if (!questionPaperFile || !selectedExam) {
      toast({ 
        title: "Missing information", 
        description: "Please select an exam and upload a PDF file", 
        variant: "destructive" 
      });
      return;
    }

    setUploading(true);
    try {
      const fileName = `${selectedExam}_${Date.now()}.pdf`;
      
      // Upload file to storage
      const { data, error: uploadError } = await supabase.storage
        .from('question-papers')
        .upload(fileName, questionPaperFile);

      if (uploadError) throw uploadError;

      // Update exam with question paper URL
      const { error: updateError } = await supabase
        .from('exams')
        .update({ question_paper_url: fileName })
        .eq('id', selectedExam);

      if (updateError) throw updateError;

      toast({ 
        title: "Success", 
        description: "Question paper uploaded successfully" 
      });
      
      setQuestionPaperFile(null);
      setSelectedExam('');
      fetchFiles();
    } catch (error) {
      console.error('Error uploading question paper:', error);
      toast({ 
        title: "Error", 
        description: "Failed to upload question paper", 
        variant: "destructive" 
      });
    } finally {
      setUploading(false);
    }
  };

  const uploadAnswerSheet = async () => {
    if (!answerSheetFile || !selectedExam || !selectedStudent) {
      toast({ 
        title: "Missing information", 
        description: "Please select an exam, student and upload a PDF file", 
        variant: "destructive" 
      });
      return;
    }

    setUploading(true);
    try {
      const fileName = `answer_sheet_${selectedExam}_${selectedStudent}_${Date.now()}.pdf`;
      
      // Upload file to storage
      const { data, error: uploadError } = await supabase.storage
        .from('answer-sheets')
        .upload(fileName, answerSheetFile);

      if (uploadError) throw uploadError;

      // Create answer sheet record in database
      const { error: insertError } = await supabase
        .from('answer_sheets')
        .insert({
          exam_id: selectedExam,
          student_id: selectedStudent,
          file_url: fileName,
          grading_status: 'pending'
        });

      if (insertError) throw insertError;

      toast({ 
        title: "Success", 
        description: "Answer sheet uploaded and assigned successfully" 
      });
      
      setAnswerSheetFile(null);
      setSelectedExam('');
      setSelectedStudent('');
      fetchFiles();
    } catch (error) {
      console.error('Error uploading answer sheet:', error);
      toast({ 
        title: "Error", 
        description: "Failed to upload answer sheet", 
        variant: "destructive" 
      });
    } finally {
      setUploading(false);
    }
  };

  const deleteFile = async (bucketName: string, fileName: string) => {
    try {
      const { error } = await supabase.storage
        .from(bucketName)
        .remove([fileName]);

      if (error) throw error;

      toast({ 
        title: "Success", 
        description: "File deleted successfully" 
      });
      
      fetchFiles();
    } catch (error) {
      console.error('Error deleting file:', error);
      toast({ 
        title: "Error", 
        description: "Failed to delete file", 
        variant: "destructive" 
      });
    }
  };

  const downloadFile = async (bucketName: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .download(fileName);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({ 
        title: "Error", 
        description: "Failed to download file", 
        variant: "destructive" 
      });
    }
  };

  const getFileUrl = (bucketName: string, fileName: string) => {
    const { data } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);
    return data.publicUrl;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">File Upload Manager</h2>
        <p className="text-muted-foreground">Upload and manage question papers and answer sheets</p>
      </div>

      <Tabs defaultValue="question-papers" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="question-papers">Question Papers</TabsTrigger>
          <TabsTrigger value="answer-sheets">Answer Sheets</TabsTrigger>
        </TabsList>

        <TabsContent value="question-papers" className="space-y-6">
          {/* Upload Question Paper */}
          <Card>
            <CardHeader>
              <CardTitle>Upload Question Paper</CardTitle>
              <CardDescription>Upload PDF question papers for exams</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="exam-select">Select Exam</Label>
                  <Select value={selectedExam} onValueChange={setSelectedExam}>
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
                <div className="space-y-2">
                  <Label htmlFor="qp-upload">Question Paper (PDF)</Label>
                  <Input
                    id="qp-upload"
                    type="file"
                    accept=".pdf"
                    onChange={handleQuestionPaperUpload}
                  />
                </div>
              </div>
              
              {questionPaperFile && (
                <div className="flex items-center space-x-2 p-3 bg-accent rounded-md">
                  <FileText className="h-4 w-4 text-accent-foreground" />
                  <span className="text-sm">{questionPaperFile.name}</span>
                  <Badge variant="secondary">{(questionPaperFile.size / 1024 / 1024).toFixed(2)} MB</Badge>
                </div>
              )}
              
              <Button 
                onClick={uploadQuestionPaper} 
                disabled={!questionPaperFile || !selectedExam || uploading}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? 'Uploading...' : 'Upload Question Paper'}
              </Button>
            </CardContent>
          </Card>

          {/* Existing Question Papers */}
          <Card>
            <CardHeader>
              <CardTitle>Existing Question Papers</CardTitle>
              <CardDescription>Manage uploaded question papers</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-4">Loading files...</div>
              ) : questionPapers.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">No question papers uploaded yet</div>
              ) : (
                <div className="space-y-2">
                  {questionPapers.map((file) => (
                    <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <FileText className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium">{file.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Uploaded: {new Date(file.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(getFileUrl('question-papers', file.name), '_blank')}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadFile('question-papers', file.name)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteFile('question-papers', file.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="answer-sheets" className="space-y-6">
          {/* Upload Answer Sheet */}
          <Card>
            <CardHeader>
              <CardTitle>Upload Answer Sheet</CardTitle>
              <CardDescription>Upload PDF answer sheets for reference or bulk processing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="exam-select-as">Select Exam</Label>
                  <Select value={selectedExam} onValueChange={setSelectedExam}>
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
                <div className="space-y-2">
                  <Label htmlFor="student-select">Select Student</Label>
                  <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a student" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((student) => (
                        <SelectItem key={student.id} value={student.id}>
                          {student.name} - {student.student_id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="as-upload">Answer Sheet (PDF)</Label>
                  <Input
                    id="as-upload"
                    type="file"
                    accept=".pdf"
                    onChange={handleAnswerSheetUpload}
                  />
                </div>
              </div>
              
              {answerSheetFile && (
                <div className="flex items-center space-x-2 p-3 bg-accent rounded-md">
                  <FileText className="h-4 w-4 text-accent-foreground" />
                  <span className="text-sm">{answerSheetFile.name}</span>
                  <Badge variant="secondary">{(answerSheetFile.size / 1024 / 1024).toFixed(2)} MB</Badge>
                </div>
              )}
              
              <Button 
                onClick={uploadAnswerSheet} 
                disabled={!answerSheetFile || !selectedExam || !selectedStudent || uploading}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? 'Uploading...' : 'Upload & Assign Answer Sheet'}
              </Button>
            </CardContent>
          </Card>

          {/* Existing Answer Sheets */}
          <Card>
            <CardHeader>
              <CardTitle>Existing Answer Sheets</CardTitle>
              <CardDescription>Manage uploaded answer sheets</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-4">Loading files...</div>
              ) : answerSheets.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">No answer sheets uploaded yet</div>
              ) : (
                <div className="space-y-2">
                  {answerSheets.map((file) => (
                    <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <FileText className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium">{file.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Uploaded: {new Date(file.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(getFileUrl('answer-sheets', file.name), '_blank')}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadFile('answer-sheets', file.name)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteFile('answer-sheets', file.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FileUploadManager;
