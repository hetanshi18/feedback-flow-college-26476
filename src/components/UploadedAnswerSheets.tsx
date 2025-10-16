import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Eye, Download, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface UploadedAnswerSheetsProps {
  examId: string;
  examName: string;
}

const UploadedAnswerSheets = ({ examId, examName }: UploadedAnswerSheetsProps) => {
  const [answerSheets, setAnswerSheets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (examId) {
      fetchAnswerSheets();
    }
  }, [examId]);

  const fetchAnswerSheets = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('answer_sheets')
        .select(`
          *,
          student:students(name, student_id, email),
          exam:exams(name)
        `)
        .eq('exam_id', examId)
        .order('upload_date', { ascending: false });

      if (error) throw error;
      setAnswerSheets(data || []);
    } catch (error) {
      console.error('Error fetching answer sheets:', error);
      toast({
        title: "Error",
        description: "Failed to fetch answer sheets",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadAnswerSheet = async (fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('answer-sheets')
        .download(fileName);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading answer sheet:', error);
      toast({
        title: "Error",
        description: "Failed to download answer sheet",
        variant: "destructive"
      });
    }
  };

  const getFileUrl = (fileName: string) => {
    const { data } = supabase.storage
      .from('answer-sheets')
      .getPublicUrl(fileName);
    return data.publicUrl;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'in_progress':
        return 'bg-primary/10 text-primary border-primary/20';
      case 'completed':
        return 'bg-success/10 text-success border-success/20';
      default:
        return 'bg-muted/10 text-muted-foreground border-muted/20';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground mt-2">Loading answer sheets...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Uploaded Answer Sheets - {examName}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {answerSheets.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No answer sheets uploaded for this exam yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {answerSheets.map((sheet) => (
              <div key={sheet.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{sheet.student?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      ID: {sheet.student?.student_id} | {sheet.student?.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Uploaded: {new Date(sheet.upload_date).toLocaleDateString()} at {new Date(sheet.upload_date).toLocaleTimeString()}
                    </p>
                    {sheet.obtained_marks !== null && (
                      <p className="text-xs font-medium text-primary">
                        Marks: {sheet.obtained_marks}/{sheet.total_marks || 'N/A'}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={getStatusColor(sheet.grading_status)}>
                      {sheet.grading_status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const url = getFileUrl(sheet.file_url);
                      window.open(url, '_blank');
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadAnswerSheet(sheet.file_url)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UploadedAnswerSheets;