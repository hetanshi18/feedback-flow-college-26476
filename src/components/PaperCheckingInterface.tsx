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
import { Textarea } from "@/components/ui/textarea";
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
  Eye,
  Upload,
  Check,
  X as XIcon,
  PenTool,
  MessageCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Canvas as FabricCanvas, Path, Ellipse, IText, Rect } from "fabric";
import { Pen, Eraser, Type, Circle as CircleIcon } from "lucide-react";

// Set up PDF.js worker using jsDelivr CDN for proper CORS support
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PaperCheckingInterfaceProps {
  preSelectedPaper?: any;
}

const PaperCheckingInterface = ({ preSelectedPaper }: PaperCheckingInterfaceProps) => {
  const { user } = useAuth();
  const canvasRefs = useRef<{ [key: number]: HTMLCanvasElement | null }>({});
  const fabricCanvases = useRef<{ [key: number]: FabricCanvas | null }>({});
  const activeToolRef = useRef<"pen" | "eraser" | "tick" | "cross" | "oval" | "textbox">("pen");
  const [activeTool, setActiveTool] = useState<
    "pen" | "eraser" | "tick" | "cross" | "oval" | "textbox"
  >("pen");
  const [annotationColor] = useState("#FF0000"); // Fixed to red
  const [currentTeacherId, setCurrentTeacherId] = useState<string | null>(null);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [selectedPaper, setSelectedPaper] = useState<any>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [pageWidth, setPageWidth] = useState<number>(800);
  const [pageHeight, setPageHeight] = useState<number>(1100);
  const [marks, setMarks] = useState<{ [key: string]: number }>({});
  const [comments, setComments] = useState<{ [key: string]: string }>({});
  const [annotations, setAnnotations] = useState<any[]>([]);
  const [totalObtainedMarks, setTotalObtainedMarks] = useState<number>(0);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [assignedQuestions, setAssignedQuestions] = useState<number[]>([]);
  const [marksPerAssignedQuestion, setMarksPerAssignedQuestion] = useState<Record<number, number>>({});

  // Get current teacher ID (for grading) and profile ID (for created_by)
  useEffect(() => {
    const fetchIds = async () => {
      if (!user?.id) return;

      const { data: teacherData } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (teacherData) setCurrentTeacherId(teacherData.id);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileData) setCurrentProfileId(profileData.id);
    };

    fetchIds();
  }, [user?.id]);

  // Set preselected paper if provided
  useEffect(() => {
    if (preSelectedPaper) {
      setSelectedPaper(preSelectedPaper);
    }
  }, [preSelectedPaper]);
  
  // Load assignment for the selected paper and current teacher
  useEffect(() => {
    const loadAssignment = async () => {
      if (!selectedPaper || !currentTeacherId) {
        setAssignedQuestions([]);
        setMarksPerAssignedQuestion({});
        return;
      }

      const { data } = await supabase
        .from("exam_teacher_assignments")
        .select("assigned_questions, marks_per_question")
        .eq("exam_id", selectedPaper.exam_id)
        .eq("teacher_id", currentTeacherId)
        .maybeSingle();

      const mq = (data?.marks_per_question as any) || {};
      setAssignedQuestions(data?.assigned_questions || []);
      setMarksPerAssignedQuestion(mq);
    };

    loadAssignment();
  }, [selectedPaper, currentTeacherId]);

  const { answerSheets, loading } = useAnswerSheets(
    currentTeacherId || undefined,
    user?.user_metadata?.role
  );

  const pendingPapers = answerSheets.filter(
    (sheet) => sheet.grading_status === "pending"
  );

  // Load annotations when paper is selected
  useEffect(() => {
    if (selectedPaper) {
      loadAnnotationsFromDB();
    }
  }, [selectedPaper]);

  const loadAnnotationsFromDB = async () => {
    if (!selectedPaper) return;

    try {
      const { data, error } = await supabase
        .from("answer_sheet_annotations")
        .select("*")
        .eq("answer_sheet_id", selectedPaper.id);

      if (error) throw error;
      setAnnotations(data || []);
    } catch (error) {
      console.error("Error loading annotations:", error);
    }
  };

  const mapFabricTypeToDbType = (fabricType: string, customData?: any): string => {
    if (customData?.annotationType) {
      return customData.annotationType;
    }
    const typeMap: { [key: string]: string } = {
      path: "pen",
      ellipse: "circle",
      "i-text": "text",
      text: "text",
      rect: "highlight",
    };
    return typeMap[fabricType] || "pen";
  };

  const saveAnnotationsToDB = async () => {
    if (!selectedPaper || !currentProfileId) {
      toast.error("Cannot save annotations");
      return;
    }

    try {
      const annotationData: any[] = [];

      Object.entries(fabricCanvases.current).forEach(([pageNum, canvas]) => {
        if (canvas) {
          const objects = canvas.getObjects();
          objects.forEach((obj: any) => {
            // Save the annotationType in the JSON
            const fabricObject = obj.toJSON(['annotationType']);

            annotationData.push({
              answer_sheet_id: selectedPaper.id,
              page_number: parseInt(pageNum),
              annotation_type: mapFabricTypeToDbType(obj.type || "path", obj),
              x_position: obj.left || 0,
              y_position: obj.top || 0,
              content: JSON.stringify(fabricObject),
              color: obj.stroke || obj.fill || annotationColor,
              created_by: currentProfileId,
            });
          });
        }
      });

      const { error: deleteError } = await supabase
        .from("answer_sheet_annotations")
        .delete()
        .eq("answer_sheet_id", selectedPaper.id);

      if (deleteError) throw deleteError;

      if (annotationData.length > 0) {
        const { error } = await supabase
          .from("answer_sheet_annotations")
          .insert(annotationData);

        if (error) throw error;
        toast.success("Annotations saved successfully");
      } else {
        toast.info("No annotations to save");
      }
    } catch (error) {
      console.error("Error saving annotations:", error);
      toast.error("Failed to save annotations");
    }
  };

  const initializeFabricCanvas = (pageNum: number) => {
    const canvasEl = canvasRefs.current[pageNum];
    
    if (!canvasEl) return;

    if (fabricCanvases.current[pageNum]) {
      fabricCanvases.current[pageNum]?.dispose();
      fabricCanvases.current[pageNum] = null;
    }

    // The canvas dimensions must match the PDF page dimensions
    canvasEl.width = pageWidth;
    canvasEl.height = pageHeight;

    const fabricCanvas = new FabricCanvas(canvasEl, {
      isDrawingMode: activeTool === "pen" || activeTool === "eraser",
      width: pageWidth,
      height: pageHeight,
      selection: true,
      backgroundColor: "transparent", // Ensure transparency
    });

    if (fabricCanvas.freeDrawingBrush) {
      fabricCanvas.freeDrawingBrush.color =
        activeTool === "eraser" ? "#FFFFFF" : annotationColor;
      fabricCanvas.freeDrawingBrush.width = activeTool === "eraser" ? 20 : 2;
    }

    fabricCanvas.on("mouse:down", (opt: any) => {
      const currentTool = activeToolRef.current;
      if (currentTool === "pen" || currentTool === "eraser") return;
      
      opt.e.preventDefault();
      const pointer = fabricCanvas.getPointer(opt.e);
      
      if (currentTool === "tick") addPresetAnnotation("tick", pointer.x, pointer.y, pageNum);
      if (currentTool === "cross") addPresetAnnotation("cross", pointer.x, pointer.y, pageNum);
      if (currentTool === "oval") addPresetAnnotation("oval", pointer.x, pointer.y, pageNum);
      if (currentTool === "textbox") addPresetAnnotation("textbox", pointer.x, pointer.y, pageNum);
    });

    fabricCanvases.current[pageNum] = fabricCanvas;
  };

  const addPresetAnnotation = (
    type: "tick" | "cross" | "oval" | "textbox",
    atX?: number,
    atY?: number,
    pageNum?: number
  ) => {
    const targetPage = pageNum ?? pageNumber;
    const canvas = fabricCanvases.current[targetPage];
    if (!canvas) return;

    const redColor = "#FF0000";
    const centerX = atX ?? canvas.width! / 2;
    const centerY = atY ?? canvas.height! / 2;

    switch (type) {
      case "tick":
        const tickPath = new Path("M 5 25 L 20 40 L 45 10", {
          stroke: redColor,
          strokeWidth: 5,
          fill: "",
          left: centerX - 25,
          top: centerY - 25,
          selectable: true,
          strokeLineCap: "round",
          strokeLineJoin: "round",
        });
        tickPath.set('annotationType', 'check');
        canvas.add(tickPath);
        break;

      case "cross":
        const crossPath1 = new Path("M 10 10 L 40 40", {
          stroke: redColor,
          strokeWidth: 5,
          fill: "",
          left: centerX - 25,
          top: centerY - 25,
          selectable: true,
          strokeLineCap: "round",
        });
        const crossPath2 = new Path("M 40 10 L 10 40", {
          stroke: redColor,
          strokeWidth: 5,
          fill: "",
          left: centerX - 25,
          top: centerY - 25,
          selectable: true,
          strokeLineCap: "round",
        });
        // Group or add separately
        crossPath1.set('annotationType', 'cross');
        crossPath2.set('annotationType', 'cross');
        canvas.add(crossPath1, crossPath2);
        break;

      case "oval":
        const oval = new Ellipse({
          left: centerX - 30,
          top: centerY - 20,
          rx: 30,
          ry: 20,
          fill: "transparent",
          stroke: redColor,
          strokeWidth: 3,
          selectable: true,
        });
        oval.set('annotationType', 'circle');
        canvas.add(oval);
        break;

      case "textbox":
        const textbox = new IText("Text", {
          left: centerX - 25,
          top: centerY - 15,
          fill: redColor,
          fontSize: 20,
          fontFamily: "Arial",
          selectable: true,
          editable: true,
        });
        textbox.set('annotationType', 'text');
        canvas.add(textbox);
        canvas.setActiveObject(textbox);
        textbox.enterEditing();
        break;
    }
    canvas.renderAll();
  };

  useEffect(() => {
    activeToolRef.current = activeTool;
    const canvas = fabricCanvases.current[pageNumber];
    if (canvas) {
      canvas.isDrawingMode = activeTool === "pen" || activeTool === "eraser";
      if (canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush.color =
          activeTool === "eraser" ? "#FFFFFF" : annotationColor;
        canvas.freeDrawingBrush.width = activeTool === "eraser" ? 20 : 2;
      }
    }
  }, [activeTool, annotationColor, pageNumber]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
    setPdfError(null);
  };

  const getPdfUrl = (fileUrl: string) => {
    if (!fileUrl) return "/sample-answer-sheet.pdf";
    if (fileUrl.startsWith("http")) return fileUrl;
    const { data } = supabase.storage.from("answer-sheets").getPublicUrl(fileUrl);
    return data.publicUrl;
  };

  const changePage = (offset: number) => {
    const newPage = Math.min(Math.max(pageNumber + offset, 1), numPages);
    setPageNumber(newPage);
  };

  const changeScale = (newScale: number) => {
    setScale(Math.min(Math.max(newScale, 0.5), 3.0));
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

  useEffect(() => {
    const total = Object.entries(marks)
      .filter(([q]) => assignedQuestions.includes(parseInt(q)))
      .reduce((sum, [, mark]) => sum + (mark || 0), 0);
    setTotalObtainedMarks(total);
  }, [marks, assignedQuestions]);

  const handleSavePaper = async () => {
    if (!selectedPaper || !currentTeacherId || !currentProfileId) {
      toast.error("Please select a paper and ensure you are logged in");
      return;
    }

    try {
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

      const questionMarks = assignedQuestions.map((qNum) => {
        const obtained = marks[qNum] ?? 0;
        const max = marksPerAssignedQuestion[qNum] ?? 0;
        return {
          answer_sheet_id: selectedPaper.id,
          question_number: qNum,
          obtained_marks: obtained,
          max_marks: max,
          graded_by: currentProfileId,
          graded_at: new Date().toISOString(),
          comments: comments[qNum] || null,
        };
      });

      const { error: marksError } = await supabase
        .from("answer_sheet_questions")
        .upsert(questionMarks);

      if (marksError) throw marksError;

      await saveAnnotationsToDB();

      toast.success("Paper graded and saved successfully!");
      setSelectedPaper(null);
      setMarks({});
      setComments({});
      setAnnotations([]);
      setTotalObtainedMarks(0);
    } catch (error) {
      console.error("Error saving paper:", error);
      toast.error("Failed to save paper grades");
    }
  };

  if (loading) {
    return <div className="text-center p-8">Loading papers...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Paper Checking Interface</h2>
        <Badge variant="secondary">{pendingPapers.length} papers pending</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          {selectedPaper ? (
            <>
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
                        variant={activeTool === "pen" ? "default" : "outline"}
                        onClick={() => setActiveTool("pen")}
                      >
                        <Pen className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant={activeTool === "eraser" ? "default" : "outline"}
                        onClick={() => setActiveTool("eraser")}
                      >
                        <Eraser className="h-4 w-4" />
                      </Button>
                      <div className="w-px h-6 bg-border" />
                      <Button
                        size="sm"
                        variant={activeTool === "tick" ? "default" : "outline"}
                        onClick={() => setActiveTool("tick")}
                        className={activeTool === "tick" ? "" : "text-red-600 hover:text-red-700"}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant={activeTool === "cross" ? "default" : "outline"}
                        onClick={() => setActiveTool("cross")}
                        className={activeTool === "cross" ? "" : "text-red-600 hover:text-red-700"}
                      >
                        <XIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant={activeTool === "oval" ? "default" : "outline"}
                        onClick={() => setActiveTool("oval")}
                        className={activeTool === "oval" ? "" : "text-red-600 hover:text-red-700"}
                      >
                        <CircleIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant={activeTool === "textbox" ? "default" : "outline"}
                        onClick={() => setActiveTool("textbox")}
                        className={activeTool === "textbox" ? "" : "text-red-600 hover:text-red-700"}
                      >
                        <Type className="h-4 w-4" />
                      </Button>
                      <div className="w-px h-6 bg-border" />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={saveAnnotationsToDB}
                      >
                        <Save className="h-4 w-4 mr-1" />
                        Save Annotations
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => changePage(-1)}
                          disabled={pageNumber <= 1}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="text-sm">
                          Page {pageNumber} of {numPages}
                        </span>
                        <Button
                          size="sm"
                          onClick={() => changePage(1)}
                          disabled={pageNumber >= numPages}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button onClick={() => changeScale(scale - 0.1)} size="sm"><Minus className="w-4 h-4" /></Button>
                        <span className="text-sm">{Math.round(scale * 100)}%</span>
                        <Button onClick={() => changeScale(scale + 0.1)} size="sm"><Plus className="w-4 h-4" /></Button>
                      </div>
                    </div>

                    {/* PDF Display with Annotation Canvas */}
                    <div className="border rounded-lg overflow-hidden bg-white">
                      <div className="flex justify-center relative inline-block">
                        <Document
                          file={getPdfUrl(selectedPaper.file_url)}
                          onLoadSuccess={onDocumentLoadSuccess}
                          onLoadError={(e) => setPdfError(e.message)}
                        >
                          <Page
                            pageNumber={pageNumber}
                            scale={scale}
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
                            onRenderSuccess={(page: any) => {
                              const viewport = page.getViewport({ scale });
                              setPageWidth(viewport.width);
                              setPageHeight(viewport.height);
                              setTimeout(() => initializeFabricCanvas(pageNumber), 100);
                            }}
                          />
                        </Document>
                        {/* The Canvas Wrapper */}
                        <div 
                          className="absolute top-0 left-0 z-50"
                          style={{ width: pageWidth, height: pageHeight }}
                        >
                          <canvas
                            ref={(el) => {
                              if (el) canvasRefs.current[pageNumber] = el;
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Grade Paper</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <ScrollArea className="h-96 pr-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                min={0}
                                max={marksPerAssignedQuestion[questionNumber] ?? undefined}
                              />
                              <Input
                                placeholder="Comment"
                                value={comments[questionNumber] || ""}
                                onChange={(e) =>
                                  handleQuestionComment(
                                    questionNumber.toString(),
                                    e.target.value
                                  )
                                }
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                    <div className="flex justify-between items-center pt-4 border-t">
                      <div className="text-lg font-semibold">
                        Total: {totalObtainedMarks}
                      </div>
                      <Button
                        onClick={handleSavePaper}
                        disabled={assignedQuestions.length === 0}
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Submit Grades
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="text-center text-muted-foreground p-10 bg-muted rounded-lg">
              Select a paper to start grading
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaperCheckingInterface;