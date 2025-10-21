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
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
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
  ChevronRight,
  Menu,
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
  const [annotationMode, setAnnotationMode] = useState<
    "none" | "mark" | "comment"
  >("none");
  const [totalObtainedMarks, setTotalObtainedMarks] = useState<number>(0);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [assignedQuestions, setAssignedQuestions] = useState<number[]>([]);
  const [marksPerAssignedQuestion, setMarksPerAssignedQuestion] = useState<Record<number, number>>({});

  // Get current user profile ID
  // useEffect(() => {
  //   const fetchCurrentUser = async () => {
  //     if (user?.id) {
  //       const { data } = await supabase
  //         .from('profiles')
  //         .select('id')
  //         .eq('user_id', user.id)
  //         .single();

  //       if (data) {
  //         setCurrentUserId(data.id);
  //       }
  //     }
  //   };
  //   fetchCurrentUser();
  // }, [user?.id]);

  // Get current teacher ID (for grading) and profile ID (for created_by)
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

  // Map Fabric.js object types to database annotation types
  const mapFabricTypeToDbType = (fabricType: string, customData?: any): string => {
    // Check if this is a preset annotation with custom metadata
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

      // Collect all canvas objects
      Object.entries(fabricCanvases.current).forEach(([pageNum, canvas]) => {
        if (canvas) {
          const objects = canvas.getObjects();
          console.log(`Page ${pageNum} has ${objects.length} objects`);

          objects.forEach((obj: any) => {
            // Properly serialize Fabric.js object
            const fabricObject = obj.toJSON();

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

      console.log(
        `Saving ${annotationData.length} annotations`,
        annotationData
      );

      // Delete existing annotations for this answer sheet
      const { error: deleteError } = await supabase
        .from("answer_sheet_annotations")
        .delete()
        .eq("answer_sheet_id", selectedPaper.id);

      if (deleteError) {
        console.error("Delete error:", deleteError);
        throw deleteError;
      }

      // Insert new annotations
      if (annotationData.length > 0) {
        const { data, error } = await supabase
          .from("answer_sheet_annotations")
          .insert(annotationData)
          .select();

        if (error) {
          console.error("Insert error:", error);
          throw error;
        }

        console.log("Successfully saved annotations:", data);
        toast.success(
          `${annotationData.length} annotation(s) saved successfully`
        );
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
    console.log("initializeFabricCanvas called for page", pageNum, "canvas element:", canvasEl);
    
    if (!canvasEl) {
      console.error("Canvas element not found for page", pageNum);
      return;
    }

    // Ensure canvas element matches PDF page size exactly
    canvasEl.width = pageWidth;
    canvasEl.height = pageHeight;
    canvasEl.style.width = `${pageWidth}px`;
    canvasEl.style.height = `${pageHeight}px`;
    
    console.log(`Canvas dimensions set to ${pageWidth}x${pageHeight}`);

    // Dispose existing canvas if present to avoid stacking
    if (fabricCanvases.current[pageNum]) {
      console.log("Disposing existing Fabric canvas for page", pageNum);
      fabricCanvases.current[pageNum]?.dispose();
      fabricCanvases.current[pageNum] = null;
    }

    const fabricCanvas = new FabricCanvas(canvasEl, {
      isDrawingMode: activeTool === "pen" || activeTool === "eraser",
      width: pageWidth,
      height: pageHeight,
      selection: true,
      backgroundColor: "transparent",
    });
    
    console.log("Fabric canvas created:", fabricCanvas);

    if (fabricCanvas.freeDrawingBrush) {
      fabricCanvas.freeDrawingBrush.color =
        activeTool === "eraser" ? "#FFFFFF" : annotationColor;
      fabricCanvas.freeDrawingBrush.width = activeTool === "eraser" ? 20 : 2;
    }

    // Click handler: place preset annotations at exact click point
    fabricCanvas.on("mouse:down", (opt: any) => {
      console.log("Canvas mouse:down event fired!");
      const currentTool = activeToolRef.current;
      console.log("Current tool:", currentTool);
      
      // Only handle preset annotations when not in drawing mode
      if (currentTool === "pen" || currentTool === "eraser") {
        console.log("Pen or eraser mode, skipping preset annotation");
        return;
      }
      
      // Prevent text selection
      opt.e.preventDefault();
      
      const pointer = fabricCanvas.getPointer(opt.e);
      console.log(`Clicked at x:${pointer.x}, y:${pointer.y}, tool:${currentTool}`);
      
      if (currentTool === "tick") addPresetAnnotation("tick", pointer.x, pointer.y, pageNum);
      if (currentTool === "cross") addPresetAnnotation("cross", pointer.x, pointer.y, pageNum);
      if (currentTool === "oval") addPresetAnnotation("oval", pointer.x, pointer.y, pageNum);
      if (currentTool === "textbox") addPresetAnnotation("textbox", pointer.x, pointer.y, pageNum);
    });
    
    console.log("Mouse:down event handler attached");

    fabricCanvases.current[pageNum] = fabricCanvas;

    // Load existing annotations for this page
    const pageAnnotations = annotations.filter(
      (ann) => ann.page_number === pageNum
    );
    
    console.log(`✓ Initialized Fabric canvas for page ${pageNum}, size: ${pageWidth}x${pageHeight}, annotations: ${pageAnnotations.length}`);
  };

  const addPresetAnnotation = (
    type: "tick" | "cross" | "oval" | "textbox",
    atX?: number,
    atY?: number,
    pageNum?: number
  ) => {
    const targetPage = pageNum ?? pageNumber;
    const canvas = fabricCanvases.current[targetPage];
    if (!canvas) {
      console.log("No canvas found for page", targetPage);
      return;
    }

    const redColor = "#FF0000";
    // Use clicked position directly, or center if not provided
    const centerX = atX ?? canvas.width! / 2;
    const centerY = atY ?? canvas.height! / 2;
    
    console.log(`Adding ${type} annotation at x:${centerX}, y:${centerY}`);

    switch (type) {
      case "tick":
        // Draw a checkmark - centered on click point
        const tickPath = new Path("M 5 25 L 20 40 L 45 10", {
          stroke: redColor,
          strokeWidth: 5,
          fill: "",
          left: centerX - 25,
          top: centerY - 25,
          selectable: true,
          strokeLineCap: "round",
          strokeLineJoin: "round",
          scaleX: 1,
          scaleY: 1,
        });
        tickPath.set('annotationType', 'check');
        canvas.add(tickPath);
        break;

      case "cross":
        // Draw an X - centered on click point
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
        crossPath1.set('annotationType', 'cross');
        crossPath2.set('annotationType', 'cross');
        canvas.add(crossPath1, crossPath2);
        break;

      case "oval":
        // Draw an oval/ellipse - centered on click point
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
        // Add an editable text box - centered on click point
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
    toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} annotation added`);
  };

  useEffect(() => {
    // Update the ref whenever activeTool changes
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

  const onDocumentLoadError = (error: Error) => {
    console.error("PDF load error:", error);
    setPdfError("Failed to load PDF. Please check the file and try again.");
  };

  const getPdfUrl = (fileUrl: string) => {
    if (!fileUrl) {
      console.log("No file URL provided, using sample PDF");
      return "/sample-answer-sheet.pdf";
    }

    // If it's already a full URL, return it
    if (fileUrl.startsWith("http")) {
      console.log("Using full URL:", fileUrl);
      return fileUrl;
    }

    // If it's a Supabase storage path, get the public URL
    const { data } = supabase.storage
      .from("answer-sheets")
      .getPublicUrl(fileUrl);

    console.log("Generated Supabase URL:", data.publicUrl);
    return data.publicUrl;
  };

  const changePage = (offset: number) => {
    const newPage = Math.min(Math.max(pageNumber + offset, 1), numPages);
    console.log(`Changing from page ${pageNumber} to page ${newPage}`);
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

  const calculateTotal = () => {
    const total = Object.entries(marks)
      .filter(([q]) => assignedQuestions.includes(parseInt(q)))
      .reduce((sum, [, mark]) => sum + (mark || 0), 0);
    setTotalObtainedMarks(total);
  };

  // Recalculate total when marks or assigned questions change
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

      // Save only assigned questions with correct max marks
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

      // Save annotations if any
      if (annotations.length > 0) {
        const annotationData = annotations.map((annotation) => ({
          answer_sheet_id: selectedPaper.id,
          page_number: annotation.page,
          x_position: annotation.x,
          y_position: annotation.y,
          annotation_type: annotation.type,
          content: annotation.content,
          color: annotation.color || "#000000",
          created_by: currentProfileId,
        }));

        const { error: annotationError } = await supabase
          .from("answer_sheet_annotations")
          .insert(annotationData);

        if (annotationError) throw annotationError;
      }

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

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (annotationMode === "none") return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const newAnnotation = {
      id: Date.now(),
      page: pageNumber,
      x: x / scale,
      y: y / scale,
      type: annotationMode,
      content:
        annotationMode === "comment" ? prompt("Enter comment:") || "" : "",
      color: annotationMode === "mark" ? "#ff0000" : "#0000ff",
    };

    setAnnotations((prev) => [...prev, newAnnotation]);
  };

  if (loading) {
    return (
      <div className="text-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="text-muted-foreground mt-2">Loading papers...</p>
      </div>
    );
  }

  // Group papers by exam
  const papersByExam = pendingPapers.reduce((acc: any, paper: any) => {
    const examId = paper.exam_id;
    if (!acc[examId]) {
      acc[examId] = {
        exam: paper.exam,
        papers: [],
      };
    }
    acc[examId].papers.push(paper);
    return acc;
  }, {});

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        {/* Collapsible Sidebar */}
        <Sidebar collapsible="icon" className="border-r">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-sm">Pending Papers</h3>
            <SidebarTrigger />
          </div>
          <SidebarContent>
            <ScrollArea className="h-[calc(100vh-80px)]">
              {Object.keys(papersByExam).length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No pending papers
                </div>
              ) : (
                Object.entries(papersByExam).map(([examId, data]: [string, any]) => {
                  const totalPapers = data.papers.length;
                  
                  return (
                    <SidebarGroup key={examId}>
                      <SidebarGroupLabel className="px-4 py-2">
                        <div className="flex flex-col gap-1 w-full">
                          <span className="font-medium text-sm">
                            {data.exam?.name || "Unnamed Exam"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {data.exam?.subject?.name}
                          </span>
                          <div className="flex gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {totalPapers} pending
                            </Badge>
                          </div>
                        </div>
                      </SidebarGroupLabel>
                      <SidebarGroupContent>
                        <SidebarMenu>
                          {data.papers.map((paper: any) => (
                            <SidebarMenuItem key={paper.id}>
                              <SidebarMenuButton
                                onClick={() => setSelectedPaper(paper)}
                                isActive={selectedPaper?.id === paper.id}
                                className="w-full"
                              >
                                <div className="flex flex-col gap-1 w-full">
                                  <span className="font-medium text-sm">
                                    {paper.student?.name}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {paper.student?.student_id}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(paper.upload_date).toLocaleDateString()}
                                  </span>
                                </div>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          ))}
                        </SidebarMenu>
                      </SidebarGroupContent>
                    </SidebarGroup>
                  );
                })
              )}
            </ScrollArea>
          </SidebarContent>
        </Sidebar>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <SidebarTrigger className="lg:hidden" />
              <div>
                <h2 className="text-2xl font-bold">Paper Checking Interface</h2>
                <p className="text-sm text-muted-foreground">
                  Select a paper from the sidebar to start grading
                </p>
              </div>
            </div>
            {selectedPaper ? (
              <div className="space-y-6">
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
                          variant={activeTool === "pen" ? "default" : "outline"}
                          onClick={() => setActiveTool("pen")}
                          title="Draw"
                        >
                          <Pen className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant={
                            activeTool === "eraser" ? "default" : "outline"
                          }
                          onClick={() => setActiveTool("eraser")}
                          title="Erase"
                        >
                          <Eraser className="h-4 w-4" />
                        </Button>

                        <div className="w-px h-6 bg-border" />

                        {/* Preset Annotations (Red Only) */}
                        <Button
                          size="sm"
                          variant={activeTool === "tick" ? "default" : "outline"}
                          onClick={() => {
                            setActiveTool("tick");
                            toast.info("Click on the PDF to place a tick mark");
                          }}
                          title="Add Tick Mark (Red)"
                          className={activeTool === "tick" ? "" : "text-red-600 hover:text-red-700"}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant={activeTool === "cross" ? "default" : "outline"}
                          onClick={() => {
                            setActiveTool("cross");
                            toast.info("Click on the PDF to place a cross mark");
                          }}
                          title="Add Cross Mark (Red)"
                          className={activeTool === "cross" ? "" : "text-red-600 hover:text-red-700"}
                        >
                          <XIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant={activeTool === "oval" ? "default" : "outline"}
                          onClick={() => {
                            setActiveTool("oval");
                            toast.info("Click on the PDF to place an oval");
                          }}
                          title="Add Oval (Red)"
                          className={activeTool === "oval" ? "" : "text-red-600 hover:text-red-700"}
                        >
                          <CircleIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant={activeTool === "textbox" ? "default" : "outline"}
                          onClick={() => {
                            setActiveTool("textbox");
                            toast.info("Click on the PDF to add a text box");
                          }}
                          title="Add Text Box (Red)"
                          className={activeTool === "textbox" ? "" : "text-red-600 hover:text-red-700"}
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
                    <div className="space-y-4">
                      {/* PDF Controls */}
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
                          <Button
                            size="sm"
                            onClick={() => changeScale(scale - 0.1)}
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                          <span className="text-sm">
                            {Math.round(scale * 100)}%
                          </span>
                          <Button
                            size="sm"
                            onClick={() => changeScale(scale + 0.1)}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* PDF Display with Annotation Canvas */}
                      <div className="border rounded-lg overflow-hidden bg-white">
                        {pdfError ? (
                          <div className="flex flex-col items-center justify-center p-8 text-center">
                            <FileText className="w-16 h-16 text-muted-foreground mb-4" />
                            <p className="text-red-500 mb-2">Error loading PDF</p>
                            <p className="text-sm text-muted-foreground">
                              {pdfError}
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setPdfError(null)}
                              className="mt-4"
                            >
                              Retry
                            </Button>
                          </div>
                        ) : (
                          <div className="flex justify-center">
                            <div className="relative inline-block">
                              <Document
                                file={getPdfUrl(selectedPaper.file_url)}
                                onLoadSuccess={onDocumentLoadSuccess}
                                onLoadError={onDocumentLoadError}
                                loading={
                                  <div className="flex items-center justify-center p-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                    <span className="ml-2">Loading PDF...</span>
                                  </div>
                                }
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
                                    console.log(`PDF page rendered: ${viewport.width}x${viewport.height}`);
                                    // Initialize after DOM updates
                                    setTimeout(
                                      () => initializeFabricCanvas(pageNumber),
                                      100
                                    );
                                  }}
                                />
                              </Document>
                              <canvas
                                ref={(el) => {
                                  if (el) {
                                    canvasRefs.current[pageNumber] = el;
                                    console.log("Canvas element ref set for page", pageNumber, el);
                                  }
                                }}
                                className="absolute top-0 left-0"
                                style={{ 
                                  zIndex: 10,
                                  width: `${pageWidth}px`,
                                  height: `${pageHeight}px`,
                                  cursor: activeTool === "pen" ? "crosshair" : activeTool === "eraser" ? "crosshair" : "pointer",
                                  pointerEvents: "auto"
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
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
                      {/* Quick grade inputs for common questions */}
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
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Sample Answer Sheet</CardTitle>
                  <CardDescription>
                    Select a paper from the sidebar to start grading, or view the
                    sample below
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* PDF Controls */}
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
                        <Button
                          size="sm"
                          onClick={() => changeScale(scale - 0.1)}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="text-sm">
                          {Math.round(scale * 100)}%
                        </span>
                        <Button
                          size="sm"
                          onClick={() => changeScale(scale + 0.1)}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Sample PDF Display */}
                    <div className="relative border rounded-lg overflow-hidden">
                      {pdfError ? (
                        <div className="flex flex-col items-center justify-center p-8 text-center">
                          <FileText className="w-16 h-16 text-muted-foreground mb-4" />
                          <p className="text-red-500 mb-2">Error loading PDF</p>
                          <p className="text-sm text-muted-foreground">
                            {pdfError}
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPdfError(null)}
                            className="mt-4"
                          >
                            Retry
                          </Button>
                        </div>
                      ) : (
                        <Document
                          file="/sample-answer-sheet.pdf"
                          onLoadSuccess={onDocumentLoadSuccess}
                          onLoadError={onDocumentLoadError}
                          className="flex justify-center"
                          loading={
                            <div className="flex items-center justify-center p-8">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                              <span className="ml-2">Loading PDF...</span>
                            </div>
                          }
                        >
                          <Page
                            pageNumber={pageNumber}
                            scale={scale}
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
                          />
                        </Document>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default PaperCheckingInterface;
