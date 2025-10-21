import { useState, useRef, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useAnswerSheets } from "@/hooks/useDatabase";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  FileText,
  Save,
  Plus,
  Minus,
  Check,
  X as XIcon,
  PenTool,
  Circle as CircleIcon,
  Type,
  Eraser,
} from "lucide-react";
import {
  PdfViewerComponent,
  Toolbar,
  Magnification,
  Navigation,
  LinkAnnotation,
  BookmarkView,
  ThumbnailView,
  Print,
  TextSelection,
  Annotation,
  FormFields,
  FormDesigner,
  Inject,
} from "@syncfusion/ej2-react-pdfviewer";
import { registerLicense } from "@syncfusion/ej2-base";

// Register Syncfusion license (you can use community license or trial)
registerLicense("ORg4AjUWIQA/Gnt2UVhhQlVFfV5AQmBIYVp/TGpJfl96cVxMZVVBJAtUQF1hTX5Vd0VjWntfdHJUT2Zb");

const PaperCheckingInterface = () => {
  const { user } = useAuth();
  const pdfViewerRef = useRef<PdfViewerComponent>(null);
  const [currentTeacherId, setCurrentTeacherId] = useState<string | null>(null);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [selectedPaper, setSelectedPaper] = useState<any>(null);
  const [marks, setMarks] = useState<{ [key: string]: number }>({});
  const [comments, setComments] = useState<{ [key: string]: string }>({});
  const [totalObtainedMarks, setTotalObtainedMarks] = useState<number>(0);
  const [assignedQuestions, setAssignedQuestions] = useState<number[]>([]);
  const [marksPerAssignedQuestion, setMarksPerAssignedQuestion] = useState<Record<number, number>>({});

  // Get current teacher ID and profile ID
  useEffect(() => {
    const fetchIds = async () => {
      if (!user?.id) return;

      // Teacher id
      const { data: teacherData, error: teacherError } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (teacherData && !teacherError) {
        setCurrentTeacherId(teacherData.id);
      } else {
        console.error("Teacher not found:", teacherError);
        toast.error("Teacher profile not found. Please contact administrator.");
      }

      // Profile id
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileData && !profileError) {
        setCurrentProfileId(profileData.id);
      } else {
        console.warn("Profile not found for user.", profileError);
      }
    };

    fetchIds();
  }, [user?.id]);
  
  // Load assignment for the selected paper
  useEffect(() => {
    const loadAssignment = async () => {
      if (!selectedPaper || !currentTeacherId) {
        setAssignedQuestions([]);
        setMarksPerAssignedQuestion({});
        return;
      }

      const { data, error } = await supabase
        .from("exam_teacher_assignments")
        .select("assigned_questions, marks_per_question")
        .eq("exam_id", selectedPaper.exam_id)
        .eq("teacher_id", currentTeacherId)
        .maybeSingle();

      if (error) {
        console.error("Failed to load assignment:", error);
        toast.error("Could not load your question assignment");
        setAssignedQuestions([]);
        setMarksPerAssignedQuestion({});
        return;
      }

      const mq = (data?.marks_per_question as any) || {};
      setAssignedQuestions(data?.assigned_questions || []);
      setMarksPerAssignedQuestion(mq);
    };

    loadAssignment();
  }, [selectedPaper, currentTeacherId]);

  // Fetch answer sheets assigned to current teacher
  const { answerSheets, loading } = useAnswerSheets(
    currentTeacherId || undefined,
    user?.user_metadata?.role
  );

  // Filter only pending/ungraded papers
  const pendingPapers = answerSheets.filter(
    (sheet) => sheet.grading_status === "pending"
  );

  // Load annotations when paper is selected
  useEffect(() => {
    if (selectedPaper && pdfViewerRef.current) {
      loadPdfWithAnnotations();
    }
  }, [selectedPaper]);

  const loadPdfWithAnnotations = async () => {
    if (!selectedPaper || !pdfViewerRef.current) return;

    try {
      const pdfUrl = getPdfUrl(selectedPaper.file_url);
      pdfViewerRef.current.load(pdfUrl, null);

      // Load existing annotations
      const { data, error } = await supabase
        .from("answer_sheet_annotations")
        .select("*")
        .eq("answer_sheet_id", selectedPaper.id);

      if (error) throw error;

      // Import annotations to PDF viewer
      if (data && data.length > 0 && pdfViewerRef.current) {
        // Syncfusion expects annotations in a specific format
        const syncfusionAnnotations = data.map((ann) => {
          try {
            const content = typeof ann.content === 'string' ? JSON.parse(ann.content) : ann.content;
            return {
              ...content,
              pageNumber: ann.page_number,
            };
          } catch {
            return null;
          }
        }).filter(Boolean);

        // Import annotations
        if (syncfusionAnnotations.length > 0) {
          pdfViewerRef.current.importAnnotation(syncfusionAnnotations);
        }
      }
    } catch (error) {
      console.error("Error loading annotations:", error);
    }
  };

  const saveAnnotationsToDB = async () => {
    if (!selectedPaper || !currentProfileId || !pdfViewerRef.current) {
      toast.error("Cannot save annotations");
      return;
    }

    try {
      // Export all annotations from Syncfusion PDF viewer
      const annotationsData = await pdfViewerRef.current.exportAnnotationsAsObject();
      
      if (!annotationsData || (annotationsData as any[]).length === 0) {
        toast.info("No annotations to save");
        return;
      }

      // Map Syncfusion annotation types to database types
      const mapAnnotationType = (type: string): string => {
        const typeMap: { [key: string]: string } = {
          'FreeText': 'text',
          'Ink': 'pen',
          'Circle': 'circle',
          'Line': 'check',
          'Stamp': 'check',
          'Highlight': 'highlight',
        };
        return typeMap[type] || 'pen';
      };

      // Transform to database format
      const annotationData = (annotationsData as any[]).map((ann: any) => ({
        answer_sheet_id: selectedPaper.id,
        page_number: ann.pageNumber || 1,
        annotation_type: mapAnnotationType(ann.shapeAnnotationType || ann.type || 'Ink'),
        x_position: ann.bounds?.X || 0,
        y_position: ann.bounds?.Y || 0,
        content: JSON.stringify(ann),
        color: ann.strokeColor || ann.fontColor || '#FF0000',
        created_by: currentProfileId,
      }));

      // Delete existing annotations for this answer sheet
      const { error: deleteError } = await supabase
        .from("answer_sheet_annotations")
        .delete()
        .eq("answer_sheet_id", selectedPaper.id);

      if (deleteError) throw deleteError;

      // Insert new annotations
      const { error: insertError } = await supabase
        .from("answer_sheet_annotations")
        .insert(annotationData)
        .select();

      if (insertError) throw insertError;

      toast.success(`${annotationData.length} annotation(s) saved successfully`);
    } catch (error) {
      console.error("Error saving annotations:", error);
      toast.error("Failed to save annotations");
    }
  };

  const getPdfUrl = (fileUrl: string) => {
    if (!fileUrl) {
      return "/sample-answer-sheet.pdf";
    }

    if (fileUrl.startsWith("http")) {
      return fileUrl;
    }

    const { data } = supabase.storage
      .from("answer-sheets")
      .getPublicUrl(fileUrl);

    return data.publicUrl;
  };

  const handleQuestionMarks = (questionNumber: string, inputMarks: number) => {
    const qNum = parseInt(questionNumber);
    const max = marksPerAssignedQuestion[qNum] ?? Infinity;
    const clamped = Math.max(0, Math.min(inputMarks, max));
    setMarks((prev) => ({ ...prev, [questionNumber]: clamped }));
  };

  const handleQuestionComment = (questionNumber: string, comment: string) => {
    setComments((prev) => ({ ...prev, [questionNumber]: comment }));
  };

  // Recalculate total when marks change
  useEffect(() => {
    const total = Object.entries(marks)
      .filter(([q]) => assignedQuestions.includes(parseInt(q)))
      .reduce((sum, [, mark]) => sum + (mark || 0), 0);
    setTotalObtainedMarks(total);
  }, [marks, assignedQuestions]);

  const handleSavePaper = async () => {
    if (!selectedPaper || !currentTeacherId) {
      toast.error("Please select a paper and ensure you are logged in");
      return;
    }

    try {
      // Update answer sheet with grades
      const { error: updateError } = await supabase
        .from("answer_sheets")
        .update({
          obtained_marks: totalObtainedMarks,
          graded_by: currentTeacherId,
          graded_at: new Date().toISOString(),
          grading_status: "completed",
          remarks: Object.entries(comments)
            .map(([q, c]) => `Q${q}: ${c}`)
            .join("\n"),
        })
        .eq("id", selectedPaper.id);

      if (updateError) throw updateError;

      // Save question marks
      const questionMarks = assignedQuestions.map((qNum) => {
        const obtained = marks[qNum] ?? 0;
        const max = marksPerAssignedQuestion[qNum] ?? 0;
        if (obtained > max) {
          throw new Error(`Marks for Q${qNum} exceed the allowed ${max}`);
        }
        return {
          answer_sheet_id: selectedPaper.id,
          question_number: qNum,
          obtained_marks: obtained,
          max_marks: max,
          graded_by: currentTeacherId,
          graded_at: new Date().toISOString(),
          comments: comments[qNum] || null,
        };
      });

      const { error: marksError } = await supabase
        .from("answer_sheet_questions")
        .upsert(questionMarks);

      if (marksError) throw marksError;

      toast.success("Paper graded and saved successfully!");
      setSelectedPaper(null);
      setMarks({});
      setComments({});
      setTotalObtainedMarks(0);
    } catch (error) {
      console.error("Error saving paper:", error);
      toast.error("Failed to save paper grades");
    }
  };

  // Annotation tool handlers
  const setAnnotationTool = (tool: string) => {
    if (!pdfViewerRef.current) return;
    
    const viewer = pdfViewerRef.current;
    
    switch (tool) {
      case 'pen':
        viewer.annotation.setAnnotationMode('Ink');
        break;
      case 'text':
        viewer.annotation.setAnnotationMode('FreeText');
        break;
      case 'circle':
        viewer.annotation.setAnnotationMode('Circle');
        break;
      case 'line':
        viewer.annotation.setAnnotationMode('Line');
        break;
      case 'eraser':
        viewer.annotation.setAnnotationMode('None');
        break;
      default:
        viewer.annotation.setAnnotationMode('None');
    }
  };

  const addCheckMark = () => {
    if (!pdfViewerRef.current) return;
    // Use line annotation for check mark
    pdfViewerRef.current.annotation.setAnnotationMode('Line');
  };

  const addCrossMark = () => {
    if (!pdfViewerRef.current) return;
    // Draw an X using line annotations
    pdfViewerRef.current.annotation.setAnnotationMode('Line');
  };

  if (loading) {
    return (
      <div className="text-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="text-muted-foreground mt-2">Loading papers...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Paper Checking Interface</h2>
        <Badge variant="secondary">{pendingPapers.length} papers pending</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Papers List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Pending Papers
            </CardTitle>
            <CardDescription>Select a paper to start grading</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingPapers.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No pending papers to grade
              </p>
            ) : (
              pendingPapers.map((paper) => (
                <Card
                  key={paper.id}
                  className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                    selectedPaper?.id === paper.id ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => setSelectedPaper(paper)}
                >
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <h4 className="font-medium">{paper.student?.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {paper.exam?.subject?.name} - {paper.exam?.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Uploaded:{" "}
                        {new Date(paper.upload_date).toLocaleDateString()}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>

        {/* PDF Viewer and Grading Interface */}
        <div className="lg:col-span-2 space-y-6">
          {selectedPaper ? (
            <>
              {/* PDF Viewer */}
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                      <CardTitle>
                        Answer Sheet: {selectedPaper.student?.name}
                      </CardTitle>
                    </div>

                    {/* Annotation Toolbar */}
                    <div className="flex items-center gap-2 p-2 bg-muted rounded-lg flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAnnotationTool('pen')}
                        title="Draw"
                      >
                        <PenTool className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAnnotationTool('eraser')}
                        title="Delete/Erase"
                      >
                        <Eraser className="h-4 w-4" />
                      </Button>

                      <div className="w-px h-6 bg-border" />

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={addCheckMark}
                        title="Add Check Mark"
                        className="text-red-600 hover:text-red-700"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={addCrossMark}
                        title="Add Cross Mark"
                        className="text-red-600 hover:text-red-700"
                      >
                        <XIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAnnotationTool('circle')}
                        title="Add Circle"
                        className="text-red-600 hover:text-red-700"
                      >
                        <CircleIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAnnotationTool('text')}
                        title="Add Text"
                        className="text-red-600 hover:text-red-700"
                      >
                        <Type className="h-4 w-4" />
                      </Button>

                      <div className="w-px h-6 bg-border" />

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={saveAnnotationsToDB}
                        title="Save annotations"
                      >
                        <Save className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg overflow-hidden bg-white" style={{ height: '600px' }}>
                    <PdfViewerComponent
                      ref={pdfViewerRef}
                      id="pdf-viewer"
                      documentPath={getPdfUrl(selectedPaper.file_url)}
                      serviceUrl="https://ej2services.syncfusion.com/production/web-services/api/pdfviewer"
                      style={{ height: '100%', width: '100%' }}
                      enableAnnotation={true}
                      enableFormFields={false}
                      enableDownload={true}
                      enablePrint={true}
                    >
                      <Inject services={[Toolbar, Magnification, Navigation, Annotation, LinkAnnotation, BookmarkView, ThumbnailView, Print, TextSelection, FormFields, FormDesigner]} />
                    </PdfViewerComponent>
                  </div>
                </CardContent>
              </Card>

              {/* Grading Form */}
              <Card>
                <CardHeader>
                  <CardTitle>Grade Paper</CardTitle>
                  <CardDescription>
                    Enter marks and comments for your assigned questions only
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <ScrollArea className="h-96 pr-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {assignedQuestions.length === 0 && (
                          <p className="text-sm text-muted-foreground">No questions assigned to you for this exam.</p>
                        )}
                        {assignedQuestions.map((questionNumber) => (
                          <div key={questionNumber} className="space-y-2">
                            <Label>
                              Question {questionNumber} (Max {marksPerAssignedQuestion[questionNumber] ?? "-"})
                            </Label>
                            <div className="flex gap-2">
                              <Input
                                type="number"
                                placeholder="Marks"
                                value={marks[questionNumber] ?? ""}
                                onChange={(e) =>
                                  handleQuestionMarks(
                                    questionNumber.toString(),
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                className="w-24"
                                min={0}
                                max={marksPerAssignedQuestion[questionNumber] ?? undefined}
                              />
                              <Input
                                placeholder="Comment (optional)"
                                value={comments[questionNumber] || ""}
                                onChange={(e) =>
                                  handleQuestionComment(
                                    questionNumber.toString(),
                                    e.target.value
                                  )
                                }
                                className="flex-1"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>

                    <div className="flex justify-between items-center pt-4 border-t">
                      <div className="text-lg font-semibold">
                        Total Marks (assigned): {totalObtainedMarks} /{" "}
                        {assignedQuestions.reduce((s, q) => s + (marksPerAssignedQuestion[q] ?? 0), 0)}
                      </div>
                      <Button
                        onClick={handleSavePaper}
                        className="flex items-center gap-2"
                        disabled={assignedQuestions.length === 0}
                      >
                        <Save className="w-4 h-4" />
                        Save & Submit Grade
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Sample Answer Sheet</CardTitle>
                <CardDescription>
                  Select a paper from the list to start grading
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden bg-white" style={{ height: '600px' }}>
                  <PdfViewerComponent
                    id="sample-pdf-viewer"
                    documentPath="/sample-answer-sheet.pdf"
                    serviceUrl="https://ej2services.syncfusion.com/production/web-services/api/pdfviewer"
                    style={{ height: '100%', width: '100%' }}
                    enableAnnotation={false}
                    enableFormFields={false}
                    enableDownload={false}
                    enablePrint={false}
                  >
                    <Inject services={[Toolbar, Magnification, Navigation, LinkAnnotation, BookmarkView, ThumbnailView, Print, TextSelection]} />
                  </PdfViewerComponent>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaperCheckingInterface;
