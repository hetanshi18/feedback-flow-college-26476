import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useAnswerSheets, useGrievances } from "@/hooks/useDatabase";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  MessageSquare,
} from "lucide-react";
import StudentAnswerSheetViewer from "./StudentAnswerSheetViewer";
import { ScrollAnimatedCard } from "./ScrollAnimatedCard";

const StudentDashboard = () => {
  const { user } = useAuth();
  const [grievanceText, setGrievanceText] = useState("");
  const [selectedAnswerSheet, setSelectedAnswerSheet] = useState<string>("");
  const [questionNumber, setQuestionNumber] = useState("");
  const [subQuestionNumber, setSubQuestionNumber] = useState("");
  const [currentMarks, setCurrentMarks] = useState("");
  const [currentStudentId, setCurrentStudentId] = useState<string | null>(null);
  const [viewingSheet, setViewingSheet] = useState<any>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  // Get current student ID
  useEffect(() => {
    const fetchCurrentStudent = async () => {
      if (user?.id) {
        const { data } = await supabase
          .from("students")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (data) {
          setCurrentStudentId(data.id);
        }
      }
    };
    fetchCurrentStudent();
  }, [user?.id]);

  // Fetch real data from database
  const { answerSheets: userAnswerSheets, loading: answersLoading } =
    useAnswerSheets(currentStudentId || undefined, user?.user_metadata?.role);
  const { grievances: userGrievances, loading: grievancesLoading } =
    useGrievances(currentStudentId || undefined, user?.user_metadata?.role);

  const handleSubmitGrievance = async () => {
    if (
      !selectedAnswerSheet ||
      !questionNumber ||
      !grievanceText.trim() ||
      !currentMarks ||
      !currentStudentId
    ) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      const { error } = await supabase.from("grievances").insert({
        answer_sheet_id: selectedAnswerSheet,
        student_id: currentStudentId,
        question_number: parseInt(questionNumber),
        sub_question: subQuestionNumber || null,
        current_marks: parseFloat(currentMarks),
        grievance_text: grievanceText,
        status: "pending",
      });

      if (error) throw error;

      toast.success(
        "Grievance submitted successfully! Your teacher will review it soon."
      );
      setGrievanceText("");
      setSelectedAnswerSheet("");
      setQuestionNumber("");
      setSubQuestionNumber("");
      setCurrentMarks("");
    } catch (error) {
      console.error("Error submitting grievance:", error);
      toast.error("Failed to submit grievance");
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="w-4 h-4" />;
      case "under_review":
        return <Eye className="w-4 h-4" />;
      case "resolved":
        return <CheckCircle className="w-4 h-4" />;
      case "rejected":
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-academic-navy/20 text-academic-navy border-academic-navy/30";
      case "under_review":
        return "bg-academic-navy/20 text-academic-navy border-academic-navy/30";
      case "resolved":
        return "bg-teal/20 text-teal border-teal/30";
      case "rejected":
        return "bg-destructive/20 text-destructive border-destructive/30";
      default:
        return "bg-academic-navy/20 text-academic-navy border-academic-navy/30";
    }
  };

  if (answersLoading || grievancesLoading) {
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
          <h1 className="text-3xl font-bold text-foreground">Student Dashboard</h1>
          <p className="text-muted-foreground">View your answer sheets and submit grievances</p>
        </div>
      </div>

      <Tabs defaultValue="answer-sheets" className="space-y-4">
        <TabsList>
          <TabsTrigger value="answer-sheets" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Answer Sheets
          </TabsTrigger>
          <TabsTrigger value="grievances" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            My Grievances
          </TabsTrigger>
        </TabsList>

        <TabsContent value="answer-sheets" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Your Answer Sheets</h2>
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Submit Grievance
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Submit a Grievance</DialogTitle>
                  <DialogDescription>
                    Submit a grievance for a specific question on your answer
                    sheet
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Select Answer Sheet</Label>
                    <select
                      className="w-full p-2 border border-input rounded-md bg-background"
                      value={selectedAnswerSheet}
                      onChange={(e) => setSelectedAnswerSheet(e.target.value)}
                    >
                      <option value="">Choose an answer sheet...</option>
                      {userAnswerSheets.map((sheet) => (
                        <option key={sheet.id} value={sheet.id}>
                          {sheet.exam?.subject?.name} - {sheet.exam?.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Question Number</Label>
                    <input
                      type="number"
                      className="w-full p-2 border border-input rounded-md bg-background"
                      placeholder="Enter question number"
                      value={questionNumber}
                      onChange={(e) => setQuestionNumber(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Sub-question (Optional)</Label>
                    <input
                      type="text"
                      className="w-full p-2 border border-input rounded-md bg-background"
                      placeholder="e.g., a, b, i, ii"
                      value={subQuestionNumber}
                      onChange={(e) => setSubQuestionNumber(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Current Marks Received</Label>
                    <input
                      type="number"
                      className="w-full p-2 border border-input rounded-md bg-background"
                      placeholder="Enter marks you received"
                      value={currentMarks}
                      onChange={(e) => setCurrentMarks(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Grievance Details</Label>
                    <Textarea
                      placeholder="Explain why you believe your answer deserves reconsideration..."
                      value={grievanceText}
                      onChange={(e) => setGrievanceText(e.target.value)}
                      className="min-h-24"
                    />
                  </div>
                  <Button onClick={handleSubmitGrievance} className="w-full">
                    Submit Grievance
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {userAnswerSheets.map((sheet, index) => (
              <ScrollAnimatedCard key={sheet.id} delay={index * 100}>
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {sheet.exam?.subject?.name}
                    </CardTitle>
                    <CardDescription>{sheet.exam?.name}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Score:</span>
                      <span className="font-semibold">
                        {sheet.obtained_marks || 0}/{sheet.total_marks || 0}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Grader:</span>
                      <span>{sheet.grader?.name || "Not graded"}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Date:</span>
                      <span>
                        {new Date(sheet.upload_date).toLocaleDateString()}
                      </span>
                    </div>
                    <Button 
                      variant="outline"
                      disabled={!sheet.grader?.name}
                      className={`w-full mt-3 ${
                        sheet.grader?.name
                          ? 'bg-success/15 text-success border-success/30 hover:bg-success/20'
                          : 'bg-muted text-muted-foreground border-border cursor-not-allowed opacity-70 hover:bg-muted'
                      }`}
                      onClick={() => {
                        if (!sheet.grader?.name) return;
                        setViewingSheet(sheet);
                        setViewerOpen(true);
                      }}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Answer Sheet
                    </Button>
                  </CardContent>
                </Card>
              </ScrollAnimatedCard>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="grievances" className="space-y-4">
          <h2 className="text-xl font-semibold">Your Grievances</h2>

          <div className="space-y-4">
            {userGrievances.map((grievance, index) => (
              <ScrollAnimatedCard key={grievance.id} delay={index * 100}>
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">
                          {grievance.answer_sheet?.exam?.subject?.name}
                        </CardTitle>
                        <CardDescription>
                          {grievance.answer_sheet?.exam?.name} - Question{" "}
                          {grievance.question_number}
                          {grievance.sub_question &&
                            ` (${grievance.sub_question})`}
                        </CardDescription>
                      </div>
                      <Badge className={getStatusColor(grievance.status)}>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(grievance.status)}
                          {grievance.status.replace("_", " ")}
                        </div>
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Your Grievance:
                      </p>
                      <p className="text-sm mt-1">{grievance.grievance_text}</p>
                    </div>

                    {grievance.teacher_response && (
                      <div
                        className={`p-3 rounded-lg border ${
                          grievance.status === "resolved"
                            ? "bg-success/10 border-success/20 text-success"
                            : grievance.status === "rejected"
                              ? "bg-destructive/10 border-destructive/20 text-destructive"
                              : "bg-muted/50 border-border text-foreground"
                        }`}
                      >
                        <p className="text-sm font-medium">
                          Teacher Response:
                        </p>
                        <p className="text-sm mt-1">
                          {grievance.teacher_response}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Responded on:{" "}
                          {new Date(grievance.reviewed_at).toLocaleDateString()}
                        </p>
                      </div>
                    )}

                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        Submitted:{" "}
                        {new Date(grievance.submitted_at).toLocaleDateString()}
                      </span>
                      <span>Reviewer: {grievance.reviewer?.name}</span>
                    </div>
                  </CardContent>
                </Card>
              </ScrollAnimatedCard>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <StudentAnswerSheetViewer
        answerSheet={viewingSheet}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
      />
    </div>
  );
};

export default StudentDashboard;
