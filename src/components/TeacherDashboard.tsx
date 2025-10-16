
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useAnswerSheets, useGrievances, useTeacherExams } from '@/hooks/useDatabase';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FileText, CheckCircle, Clock, Eye, MessageSquare, AlertTriangle, Star, Upload } from 'lucide-react';
import PaperCheckingInterface from './PaperCheckingInterface';
import UploadedAnswerSheets from './UploadedAnswerSheets';
import StudentAnswerSheetViewer from './StudentAnswerSheetViewer';

const TeacherDashboard = () => {
  const { user } = useAuth();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [viewingAnswerSheet, setViewingAnswerSheet] = useState<any>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  // Get current teacher ID from teachers table
  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (user?.id) {
        console.log('Fetching user details for:', user.id);
        const { data } = await supabase.rpc('get_current_user_details');
        
        console.log('User details response:', data);
        if (data?.[0]?.record_id && data[0].user_type === 'teacher') {
          console.log('Setting teacher ID:', data[0].record_id);
          setCurrentUserId(data[0].record_id);
        } else {
          console.log('User is not a teacher or no record found');
        }
      }
    };
    fetchCurrentUser();
  }, [user?.id]);

  // Fetch real data from database
  console.log('Teacher Dashboard - currentUserId:', currentUserId);
  console.log('Teacher Dashboard - user role:', user?.user_metadata?.role);
  
  const { answerSheets, loading: answersLoading } = useAnswerSheets(currentUserId || undefined, user?.user_metadata?.role);
  const { grievances, loading: grievancesLoading, updateGrievanceStatus } = useGrievances(currentUserId || undefined, user?.user_metadata?.role);
  const { teacherExams, loading: examsLoading } = useTeacherExams(currentUserId || undefined);

  console.log('Teacher exams:', teacherExams);
  console.log('Loading states - exams:', examsLoading, 'answers:', answersLoading);

  // Filter data
  const pendingPapers = answerSheets.filter(sheet => sheet.grading_status === 'pending');
  const completedPapers = answerSheets.filter(sheet => sheet.grading_status === 'completed');
  const pendingGrievances = grievances.filter(g => g.status === 'pending');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'under_review':
        return <Eye className="w-4 h-4" />;
      case 'resolved':
        return <CheckCircle className="w-4 h-4" />;
      case 'rejected':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'under_review':
        return 'bg-primary/10 text-primary border-primary/20';
      case 'resolved':
        return 'bg-success/10 text-success border-success/20';
      case 'rejected':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      default:
        return 'bg-muted/10 text-muted-foreground border-muted/20';
    }
  };

  const handleGrievanceAction = async (grievanceId: string, action: 'approve' | 'reject', response: string, updatedMarks?: number) => {
    const status = action === 'approve' ? 'resolved' : 'rejected';
    await updateGrievanceStatus(grievanceId, status, response, updatedMarks);
  };

  if (answersLoading || grievancesLoading || examsLoading) {
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
          <h1 className="text-3xl font-bold text-foreground">Teacher Dashboard</h1>
          <p className="text-muted-foreground">Grade papers and manage student grievances</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Star className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="grading" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Paper Grading
          </TabsTrigger>
          <TabsTrigger value="uploaded-sheets" className="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Uploaded Sheets
          </TabsTrigger>
          <TabsTrigger value="grievances" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Grievances
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <h3 className="text-sm font-medium">Papers to Grade</h3>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingPapers.length}</div>
                <p className="text-xs text-muted-foreground">
                  {pendingPapers.length === 1 ? 'paper' : 'papers'} pending review
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <h3 className="text-sm font-medium">Completed</h3>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{completedPapers.length}</div>
                <p className="text-xs text-muted-foreground">
                  {completedPapers.length === 1 ? 'paper' : 'papers'} graded
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <h3 className="text-sm font-medium">Pending Grievances</h3>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingGrievances.length}</div>
                <p className="text-xs text-muted-foreground">
                  {pendingGrievances.length === 1 ? 'grievance' : 'grievances'} to review
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <h3 className="text-sm font-medium">Assigned Exams</h3>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{teacherExams.length}</div>
                <p className="text-xs text-muted-foreground">
                  exams assigned to you
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Assigned Exams</h3>
              </CardHeader>
              <CardContent className="space-y-3">
                {teacherExams.slice(0, 5).map((assignment) => (
                  <div key={assignment.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{assignment.exam?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {assignment.exam?.subject?.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Questions: {assignment.assigned_questions?.join(', ')}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {assignment.exam?.status}
                    </Badge>
                  </div>
                ))}
                {teacherExams.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">No exams assigned yet</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Recent Papers to Grade</h3>
              </CardHeader>
              <CardContent className="space-y-3">
                {pendingPapers.slice(0, 5).map((paper) => (
                  <div key={paper.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{paper.student?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {paper.exam?.subject?.name} - {paper.exam?.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Uploaded: {new Date(paper.upload_date).toLocaleDateString()}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => setActiveTab('grading')}>
                      Grade
                    </Button>
                  </div>
                ))}
                {pendingPapers.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">No papers pending</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Recent Grievances</h3>
              </CardHeader>
              <CardContent className="space-y-3">
                {pendingGrievances.slice(0, 5).map((grievance) => (
                  <div key={grievance.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{grievance.student?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Question {grievance.question_number}
                        {grievance.sub_question && ` (${grievance.sub_question})`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(grievance.submitted_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => setActiveTab('grievances')}>
                      Review
                    </Button>
                  </div>
                ))}
                {pendingGrievances.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">No pending grievances</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="grading" className="space-y-4">
          <PaperCheckingInterface />
        </TabsContent>

        <TabsContent value="uploaded-sheets" className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-4">Uploaded Answer Sheets by Exam</h2>
            <div className="space-y-6">
              {teacherExams.map((assignment) => (
                <UploadedAnswerSheets
                  key={assignment.exam.id}
                  examId={assignment.exam.id}
                  examName={assignment.exam.name}
                />
              ))}
              {teacherExams.length === 0 && (
                <Card>
                  <CardContent className="p-6 text-center text-muted-foreground">
                    <Upload className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No exams assigned to you yet</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="grievances" className="space-y-4">
          <h2 className="text-xl font-semibold">Student Grievances</h2>
          
          <div className="space-y-4">
            {grievances.map((grievance) => (
              <Card key={grievance.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium">{grievance.student?.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {grievance.answer_sheet?.exam?.subject?.name} - Question {grievance.question_number}
                        {grievance.sub_question && ` (${grievance.sub_question})`}
                      </p>
                    </div>
                    <Badge className={getStatusColor(grievance.status)}>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(grievance.status)}
                        {grievance.status.replace('_', ' ')}
                      </div>
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium">Current Marks: {grievance.current_marks}</p>
                    <p className="text-sm font-medium text-muted-foreground mt-1">Student's Concern:</p>
                    <p className="text-sm mt-1">{grievance.grievance_text}</p>
                  </div>

                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setViewingAnswerSheet(grievance.answer_sheet);
                      setIsViewerOpen(true);
                    }}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View Paper
                  </Button>

                  {grievance.status === 'pending' && (
                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm">Approve & Update Marks</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Approve Grievance</DialogTitle>
                            <DialogDescription>
                              Update the marks and provide a response to the student
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label>Updated Marks</Label>
                              <input
                                type="number"
                                className="w-full p-2 border rounded-md"
                                placeholder={String(grievance.current_marks)}
                                id={`updated-marks-${grievance.id}`}
                              />
                            </div>
                            <div>
                              <Label>Response to Student</Label>
                              <Textarea
                                placeholder="Explain the mark adjustment..."
                                id={`response-${grievance.id}`}
                              />
                            </div>
                            <Button
                              onClick={() => {
                                const marksInput = document.getElementById(`updated-marks-${grievance.id}`) as HTMLInputElement;
                                const responseInput = document.getElementById(`response-${grievance.id}`) as HTMLTextAreaElement;
                                const updatedMarks = parseFloat(marksInput.value) || grievance.current_marks;
                                handleGrievanceAction(grievance.id, 'approve', responseInput.value || 'Marks updated after review', updatedMarks);
                              }}
                            >
                              Approve & Update
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">Reject</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Reject Grievance</DialogTitle>
                            <DialogDescription>
                              Provide a reason for rejecting this grievance
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label>Response to Student</Label>
                              <Textarea
                                placeholder="Explain why the original marks are correct..."
                                id={`reject-response-${grievance.id}`}
                              />
                            </div>
                            <Button
                              variant="destructive"
                              onClick={() => {
                                const responseInput = document.getElementById(`reject-response-${grievance.id}`) as HTMLTextAreaElement;
                                handleGrievanceAction(grievance.id, 'reject', responseInput.value || 'The original marks are correct');
                              }}
                            >
                              Reject Grievance
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}

                  {grievance.teacher_response && (
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <p className="text-sm font-medium">Your Response:</p>
                      <p className="text-sm mt-1">{grievance.teacher_response}</p>
                      {grievance.updated_marks && (
                        <p className="text-sm mt-2 font-medium">
                          Updated Marks: {String(grievance.updated_marks)}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground">
                    Submitted: {new Date(grievance.submitted_at).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <StudentAnswerSheetViewer
        answerSheet={viewingAnswerSheet}
        open={isViewerOpen}
        onOpenChange={setIsViewerOpen}
      />
    </div>
  );
};

export default TeacherDashboard;
