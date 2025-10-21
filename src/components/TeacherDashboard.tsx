
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { FileText, CheckCircle, Clock, Eye, MessageSquare, AlertTriangle, Star, Upload, BookOpen, ChevronRight } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import PaperCheckingInterface from './PaperCheckingInterface';
import UploadedAnswerSheets from './UploadedAnswerSheets';
import StudentAnswerSheetViewer from './StudentAnswerSheetViewer';

const TeacherDashboard = () => {
  const { user } = useAuth();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [viewingAnswerSheet, setViewingAnswerSheet] = useState<any>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [gradingAnswerSheet, setGradingAnswerSheet] = useState<any>(null);
  const [isGradingOpen, setIsGradingOpen] = useState(false);

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

  // Calculate statistics for pie chart
  const totalPapers = answerSheets.length;
  const checkedPapers = completedPapers.length;
  const uncheckedPapers = pendingPapers.length;

  const pieData = [
    { name: 'Checked', value: checkedPapers, color: 'hsl(var(--success))' },
    { name: 'Unchecked', value: uncheckedPapers, color: 'hsl(var(--warning))' },
  ];

  // Get papers for selected exam
  const selectedExamPapers = selectedExamId 
    ? answerSheets.filter(sheet => sheet.exam_id === selectedExamId)
    : [];

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
          <TabsTrigger value="my-exams" className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            My Exams
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

        <TabsContent value="my-exams" className="space-y-6">
          {/* Statistics Section */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Grading Progress</CardTitle>
                <CardDescription>Overview of paper checking status</CardDescription>
              </CardHeader>
              <CardContent>
                {totalPapers > 0 ? (
                  <div className="space-y-4">
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold">{totalPapers}</p>
                        <p className="text-sm text-muted-foreground">Total Papers</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-success">{checkedPapers}</p>
                        <p className="text-sm text-muted-foreground">Checked</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-warning">{uncheckedPapers}</p>
                        <p className="text-sm text-muted-foreground">Unchecked</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    No papers assigned yet
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
                <CardDescription>Your teaching workload</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <BookOpen className="h-8 w-8 text-primary" />
                      <div>
                        <p className="font-semibold">Assigned Exams</p>
                        <p className="text-sm text-muted-foreground">Total exams you're evaluating</p>
                      </div>
                    </div>
                    <p className="text-3xl font-bold">{teacherExams.length}</p>
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Clock className="h-8 w-8 text-warning" />
                      <div>
                        <p className="font-semibold">Pending Papers</p>
                        <p className="text-sm text-muted-foreground">Papers awaiting grading</p>
                      </div>
                    </div>
                    <p className="text-3xl font-bold">{uncheckedPapers}</p>
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <MessageSquare className="h-8 w-8 text-destructive" />
                      <div>
                        <p className="font-semibold">Pending Grievances</p>
                        <p className="text-sm text-muted-foreground">Student concerns to address</p>
                      </div>
                    </div>
                    <p className="text-3xl font-bold">{pendingGrievances.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Exams List */}
          {!selectedExamId ? (
            <Card>
              <CardHeader>
                <CardTitle>Your Assigned Exams</CardTitle>
                <CardDescription>Click on an exam to view and grade answer sheets</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {teacherExams.map((assignment) => {
                    const examPapers = answerSheets.filter(sheet => sheet.exam_id === assignment.exam.id);
                    const examPending = examPapers.filter(sheet => sheet.grading_status === 'pending').length;
                    const examCompleted = examPapers.filter(sheet => sheet.grading_status === 'completed').length;
                    
                    return (
                      <div
                        key={assignment.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:border-primary hover:bg-accent/50 cursor-pointer transition-colors"
                        onClick={() => setSelectedExamId(assignment.exam.id)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <BookOpen className="h-5 w-5 text-primary" />
                            <div>
                              <h4 className="font-semibold">{assignment.exam?.name}</h4>
                              <p className="text-sm text-muted-foreground">
                                {assignment.exam?.subject?.name} • {assignment.exam?.subject?.department?.name}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Questions: {assignment.assigned_questions?.join(', ')}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm font-medium">{examPapers.length} Papers</p>
                            <div className="flex gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                {examCompleted}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                <Clock className="h-3 w-3 mr-1" />
                                {examPending}
                              </Badge>
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </div>
                    );
                  })}
                  {teacherExams.length === 0 && (
                    <div className="text-center py-12">
                      <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                      <p className="text-muted-foreground">No exams assigned to you yet</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            // Show papers for selected exam
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>
                      {teacherExams.find(e => e.exam.id === selectedExamId)?.exam?.name}
                    </CardTitle>
                    <CardDescription>
                      Answer sheets for this exam
                    </CardDescription>
                  </div>
                  <Button variant="outline" onClick={() => setSelectedExamId(null)}>
                    Back to Exams
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {selectedExamPapers.map((paper) => (
                    <div
                      key={paper.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1">
                        <h4 className="font-medium">{paper.student?.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          Student ID: {paper.student?.student_id}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Uploaded: {new Date(paper.upload_date).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          {paper.grading_status === 'completed' ? (
                            <div>
                              <p className="text-sm font-medium">
                                {paper.obtained_marks}/{paper.total_marks} marks
                              </p>
                              <Badge className="mt-1 bg-success/10 text-success border-success/20">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Graded
                              </Badge>
                            </div>
                          ) : (
                            <Badge className="bg-warning/10 text-warning border-warning/20">
                              <Clock className="h-3 w-3 mr-1" />
                              Pending
                            </Badge>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setViewingAnswerSheet(paper);
                            setIsViewerOpen(true);
                          }}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            setGradingAnswerSheet(paper);
                            setIsGradingOpen(true);
                          }}
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          Grade
                        </Button>
                      </div>
                    </div>
                  ))}
                  {selectedExamPapers.length === 0 && (
                    <div className="text-center py-12">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                      <p className="text-muted-foreground">No answer sheets uploaded yet for this exam</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
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

      <Dialog open={isGradingOpen} onOpenChange={setIsGradingOpen}>
        <DialogContent className="max-w-[95vw] h-[95vh] p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Grade Answer Sheet</DialogTitle>
            <DialogDescription>
              {gradingAnswerSheet?.student?.name} - {gradingAnswerSheet?.exam?.subject?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="h-full overflow-hidden">
            {isGradingOpen && <PaperCheckingInterface preSelectedPaper={gradingAnswerSheet} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeacherDashboard;
