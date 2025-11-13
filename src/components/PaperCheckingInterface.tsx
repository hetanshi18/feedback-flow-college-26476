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
  ChevronLeft,
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
  onClose?: () => void;
}

const PaperCheckingInterface = ({ preSelectedPaper, onClose }: PaperCheckingInterfaceProps) => {
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
  const [selectedQuestion, setSelectedQuestion] = useState<number | null>(null);
  const [markAnnotations, setMarkAnnotations] = useState<{ [key: string]: any }>({}); // Store fabric objects for mark annotations
  const [isPapersSidebarOpen, setIsPapersSidebarOpen] = useState<boolean>(true);
  const [isQuestionsSidebarOpen, setIsQuestionsSidebarOpen] = useState<boolean>(true);

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

  // Load annotations and existing marks when paper is selected
  useEffect(() => {
    if (selectedPaper) {
      loadAnnotationsFromDB();
      loadExistingMarks();
    }
  }, [selectedPaper]);

  const loadExistingMarks = async () => {
    if (!selectedPaper) return;

    try {
      // Load existing question marks
      const { data: questionsData, error } = await supabase
        .from("answer_sheet_questions")
        .select("*")
        .eq("answer_sheet_id", selectedPaper.id);

      if (error) throw error;

      // Set marks state
      const marksState: { [key: string]: number } = {};
      questionsData?.forEach((q) => {
        if (q.obtained_marks !== null) {
          marksState[q.question_number.toString()] = q.obtained_marks;
        }
      });
      setMarks(marksState);

      // Load comments
      const commentsState: { [key: string]: string } = {};
      questionsData?.forEach((q) => {
        if (q.comments) {
          commentsState[q.question_number.toString()] = q.comments;
        }
      });
      setComments(commentsState);
    } catch (error) {
      console.error("Error loading existing marks:", error);
    }
  };

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

  const initializeFabricCanvas = async (pageNum: number) => {
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
      isDrawingMode: activeTool === "pen", // Only pen uses drawing mode, not eraser
      width: pageWidth,
      height: pageHeight,
      selection: activeTool !== "eraser", // Disable selection when eraser is active
      backgroundColor: "transparent", // Ensure transparency
    });

    if (fabricCanvas.freeDrawingBrush) {
      fabricCanvas.freeDrawingBrush.color = annotationColor;
      fabricCanvas.freeDrawingBrush.width = 2;
    }

    fabricCanvas.on("mouse:down", (opt: any) => {
      const currentTool = activeToolRef.current;

      // Handle eraser tool - delete clicked object
      if (currentTool === "eraser") {
        const target = opt.target;
        if (target && target !== fabricCanvas) {
          // Check if it's a mark annotation (IText that starts with "Q")
          const isMarkAnnotation = target.type === "i-text" &&
            target.text &&
            typeof target.text === "string" &&
            target.text.startsWith("Q");

          if (isMarkAnnotation) {
            // Extract question number from text (format: "Q1: 5/10")
            const match = target.text.match(/^Q(\d+):/);
            if (match) {
              const questionNum = match[1];
              // Remove from markAnnotations state
              setMarkAnnotations((prev) => {
                const newState = { ...prev };
                delete newState[questionNum];
                return newState;
              });
              // Clear marks for this question
              setMarks((prev) => {
                const newState = { ...prev };
                delete newState[questionNum];
                return newState;
              });
            }
          }

          // Remove from canvas
          fabricCanvas.remove(target);
          fabricCanvas.renderAll();
          toast.success("Annotation deleted");
          return;
        }
        return;
      }

      // Handle pen tool - allow drawing
      if (currentTool === "pen") return;

      // Handle preset annotations
      opt.e.preventDefault();
      const pointer = fabricCanvas.getPointer(opt.e);

      if (currentTool === "tick") addPresetAnnotation("tick", pointer.x, pointer.y, pageNum);
      if (currentTool === "cross") addPresetAnnotation("cross", pointer.x, pointer.y, pageNum);
      if (currentTool === "oval") addPresetAnnotation("oval", pointer.x, pointer.y, pageNum);
      if (currentTool === "textbox") addPresetAnnotation("textbox", pointer.x, pointer.y, pageNum);
    });

    fabricCanvases.current[pageNum] = fabricCanvas;

    // Load existing mark annotations for this page
    loadMarkAnnotationsForPage(pageNum, fabricCanvas);
  };

  const loadMarkAnnotationsForPage = async (pageNum: number, canvas: FabricCanvas) => {
    if (!selectedPaper) return;

    try {
      // Load mark annotations (text type) for this page
      const { data: markAnnotations, error } = await supabase
        .from("answer_sheet_annotations")
        .select("*, answer_sheet_questions(question_number, max_marks, obtained_marks)")
        .eq("answer_sheet_id", selectedPaper.id)
        .eq("page_number", pageNum)
        .eq("annotation_type", "text");

      if (error) throw error;

      markAnnotations?.forEach((ann: any) => {
        try {
          const content = ann.content ? JSON.parse(ann.content) : null;
          if (content) {
            // Reconstruct IText from JSON
            const markText = new IText(content.text || `Q${ann.answer_sheet_questions?.question_number}: ${ann.answer_sheet_questions?.obtained_marks}/${ann.answer_sheet_questions?.max_marks}`, {
              left: content.left || ann.x_position,
              top: content.top || ann.y_position,
              fontSize: content.fontSize || 24,
              fill: content.fill || ann.color || '#FF0000',
              fontFamily: content.fontFamily || 'Arial',
              fontWeight: content.fontWeight || 'bold',
              backgroundColor: content.backgroundColor || 'rgba(255, 255, 255, 0.9)',
              padding: content.padding || 8,
              borderColor: content.borderColor || '#000000',
              borderWidth: content.borderWidth || 2,
              selectable: true,
              hasControls: true,
              hasBorders: true,
            });

            canvas.add(markText);

            // Store in markAnnotations state
            const questionNum = ann.answer_sheet_questions?.question_number;
            if (questionNum) {
              setMarkAnnotations((prev) => ({
                ...prev,
                [questionNum.toString()]: { ...markText, canvas, pageNumber: pageNum },
              }));
            }
          }
        } catch (err) {
          console.error("Error loading mark annotation:", err);
        }
      });

      canvas.renderAll();
    } catch (error) {
      console.error("Error loading mark annotations for page:", error);
    }
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
      // Only pen uses drawing mode, eraser deletes objects on click
      canvas.isDrawingMode = activeTool === "pen";
      canvas.selection = activeTool !== "eraser"; // Disable selection when eraser is active

      if (canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush.color = annotationColor;
        canvas.freeDrawingBrush.width = 2;
      }

      // Update cursor based on tool
      if (canvas.lowerCanvasEl) {
        canvas.lowerCanvasEl.style.cursor =
          activeTool === "eraser" ? "not-allowed" :
            activeTool === "pen" ? "crosshair" :
              "default";
      }
      if (canvas.upperCanvasEl) {
        canvas.upperCanvasEl.style.cursor =
          activeTool === "eraser" ? "not-allowed" :
            activeTool === "pen" ? "crosshair" :
              "default";
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

  const handleQuestionMarks = async (questionNumber: number, selectedMarks: number) => {
    const max = marksPerAssignedQuestion[questionNumber] ?? Infinity;
    const clamped = Math.max(0, Math.min(selectedMarks, max));
    const questionKey = questionNumber.toString();

    // Update marks state
    setMarks((prev) => ({ ...prev, [questionKey]: clamped }));

    // Remove existing mark annotation for this question if any
    const existingAnnotation = markAnnotations[questionKey];
    if (existingAnnotation) {
      Object.values(fabricCanvases.current).forEach((canvas) => {
        if (canvas && existingAnnotation.canvas === canvas) {
          canvas.remove(existingAnnotation);
          canvas.renderAll();
        }
      });
    }

    // Add new mark annotation to the current page
    const canvas = fabricCanvases.current[pageNumber];
    if (canvas && clamped >= 0) {
      // Calculate position - distribute marks vertically on the right side
      const questionIndex = assignedQuestions.indexOf(questionNumber);
      const totalQuestions = assignedQuestions.length;
      const verticalSpacing = pageHeight / Math.max(totalQuestions, 10); // Space them out
      const topPosition = pageHeight * 0.05 + (questionIndex * verticalSpacing);

      // Create a text annotation showing the marks
      const markText = new IText(`Q${questionNumber}: ${clamped}/${max}`, {
        left: pageWidth * 0.75, // Position on right side
        top: Math.min(topPosition, pageHeight * 0.9), // Distribute vertically, but don't go off page
        fontSize: 22,
        fill: clamped === max ? '#00AA00' : clamped > 0 ? '#FF6600' : '#FF0000', // Green for full marks, orange for partial, red for zero
        fontFamily: 'Arial',
        fontWeight: 'bold',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        padding: 6,
        borderColor: clamped === max ? '#00AA00' : clamped > 0 ? '#FF6600' : '#FF0000',
        borderWidth: 2,
        selectable: true,
        hasControls: true,
        hasBorders: true,
      });

      canvas.add(markText);
      canvas.renderAll();

      // Store the annotation
      setMarkAnnotations((prev) => ({
        ...prev,
        [questionKey]: { ...markText, canvas, pageNumber },
      }));

      // Save annotation to database
      await saveMarkAnnotation(questionNumber, clamped, markText, pageNumber);
    }

    toast.success(`Marks ${clamped}/${max} assigned to Question ${questionNumber}`);
  };

  const saveMarkAnnotation = async (questionNumber: number, marks: number, fabricObject: any, pageNum: number) => {
    if (!selectedPaper || !currentProfileId) return;

    try {
      // Get or create question record
      const { data: questionData, error: questionError } = await supabase
        .from("answer_sheet_questions")
        .upsert({
          answer_sheet_id: selectedPaper.id,
          question_number: questionNumber,
          max_marks: marksPerAssignedQuestion[questionNumber] ?? 0,
          obtained_marks: marks,
          graded_by: currentProfileId,
          graded_at: new Date().toISOString(),
        }, {
          onConflict: 'answer_sheet_id,question_number',
        })
        .select()
        .single();

      if (questionError) throw questionError;

      // Save annotation
      const annotationData = {
        answer_sheet_id: selectedPaper.id,
        question_id: questionData.id,
        page_number: pageNum,
        x_position: fabricObject.left,
        y_position: fabricObject.top,
        annotation_type: 'text',
        content: JSON.stringify(fabricObject.toJSON()),
        color: fabricObject.fill,
        created_by: currentProfileId,
      };

      // Delete old mark annotations for this question
      if (questionData.id) {
        await supabase
          .from("answer_sheet_annotations")
          .delete()
          .eq("answer_sheet_id", selectedPaper.id)
          .eq("question_id", questionData.id)
          .eq("annotation_type", "text");
      }

      // Insert new annotation
      const { error: annotationError } = await supabase
        .from("answer_sheet_annotations")
        .insert(annotationData);

      if (annotationError) throw annotationError;
    } catch (error) {
      console.error("Error saving mark annotation:", error);
    }
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
      onClose?.();
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold">Paper Checking Interface</h2>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{pendingPapers.length} papers pending</Badge>
          {onClose && (
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-4 h-[calc(100vh-180px)] relative">
        {/* Collapsible Pending Papers Sidebar */}
        {!selectedPaper || isPapersSidebarOpen ? (
          <Card className={`w-64 flex-shrink-0 flex flex-col transition-all ${selectedPaper ? 'absolute left-0 top-0 z-50 h-full shadow-lg' : ''}`}>
            <CardHeader className="flex-shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <FileText className="w-4 h-4" />
                  Pending Papers
                </CardTitle>
                {selectedPaper && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsPapersSidebarOpen(false)}
                    className="h-6 w-6 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
              <ScrollArea className="h-full">
                <div className="space-y-2">
                  {pendingPapers.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4 text-sm">
                      No pending papers
                    </p>
                  ) : (
                    pendingPapers.map((paper) => (
                      <div
                        key={paper.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${selectedPaper?.id === paper.id ? "ring-2 ring-primary bg-primary/5" : ""
                          }`}
                        onClick={() => {
                          setSelectedPaper(paper);
                          setIsPapersSidebarOpen(false);
                          setIsQuestionsSidebarOpen(true); // Auto-open questions sidebar when paper is selected
                        }}
                      >
                        <h4 className="font-medium text-sm">{paper.student?.name}</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          {paper.exam?.subject?.name} - {paper.exam?.name}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="absolute left-2 top-2 z-50 h-8 w-8 p-0"
            onClick={() => setIsPapersSidebarOpen(true)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex gap-4 min-w-0 relative">
          {selectedPaper ? (
            <>
              {/* PDF Viewer - Adjusts width based on sidebar */}
              <Card className={`flex-1 flex flex-col min-h-0 h-full overflow-hidden transition-all ${isQuestionsSidebarOpen ? 'mr-0' : ''}`}>
                <CardHeader className="flex-shrink-0 pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      {selectedPaper.student?.name} - {selectedPaper.exam?.subject?.name}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => changePage(-1)}
                        disabled={pageNumber <= 1}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-sm min-w-[80px] text-center">
                        Page {pageNumber} / {numPages}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => changePage(1)}
                        disabled={pageNumber >= numPages}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                      <div className="w-px h-6 bg-border" />
                      <Button onClick={() => changeScale(scale - 0.1)} size="sm" variant="outline">
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="text-sm min-w-[50px] text-center">{Math.round(scale * 100)}%</span>
                      <Button onClick={() => changeScale(scale + 0.1)} size="sm" variant="outline">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  {/* Compact Annotation Toolbar */}
                  <div className="flex items-center gap-1 p-2 bg-muted rounded-lg flex-wrap mt-2">
                    <Button
                      size="sm"
                      variant={activeTool === "pen" ? "default" : "outline"}
                      onClick={() => setActiveTool("pen")}
                      className="h-7"
                    >
                      <Pen className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant={activeTool === "eraser" ? "default" : "outline"}
                      onClick={() => setActiveTool("eraser")}
                      className="h-7"
                    >
                      <Eraser className="h-3 w-3" />
                    </Button>
                    <div className="w-px h-4 bg-border" />
                    <Button
                      size="sm"
                      variant={activeTool === "tick" ? "default" : "outline"}
                      onClick={() => setActiveTool("tick")}
                      className="h-7"
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant={activeTool === "cross" ? "default" : "outline"}
                      onClick={() => setActiveTool("cross")}
                      className="h-7"
                    >
                      <XIcon className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant={activeTool === "oval" ? "default" : "outline"}
                      onClick={() => setActiveTool("oval")}
                      className="h-7"
                    >
                      <CircleIcon className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant={activeTool === "textbox" ? "default" : "outline"}
                      onClick={() => setActiveTool("textbox")}
                      className="h-7"
                    >
                      <Type className="h-3 w-3" />
                    </Button>
                    <div className="w-px h-4 bg-border" />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={saveAnnotationsToDB}
                      className="h-7 text-xs"
                    >
                      <Save className="h-3 w-3 mr-1" />
                      Save
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-auto p-4">
                  <div className="border rounded-lg overflow-auto bg-gray-50 flex justify-center min-h-full">
                    <div className="relative inline-block">
                      <Document
                        file={getPdfUrl(selectedPaper.file_url)}
                        onLoadSuccess={onDocumentLoadSuccess}
                        onLoadError={(e) => setPdfError(e.message)}
                        loading={
                          <div className="flex items-center justify-center p-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
                            setTimeout(() => initializeFabricCanvas(pageNumber), 100);
                          }}
                          loading={
                            <div className="flex items-center justify-center p-8">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                            </div>
                          }
                        />
                      </Document>
                      <div
                        className="absolute top-0 left-0 z-50 pointer-events-auto"
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
                </CardContent>
              </Card>

              {/* Questions Sidebar - Fixed on right, doesn't overlap */}
              {isQuestionsSidebarOpen ? (
                <Card className="w-72 flex-shrink-0 flex flex-col h-full shadow-lg border-2">
                  <CardHeader className="flex-shrink-0 pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Questions</CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsQuestionsSidebarOpen(false)}
                        className="h-6 w-6 p-0"
                      >
                        <XIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-auto p-3">
                    <ScrollArea className="h-full">
                      <div className="space-y-2">
                        {assignedQuestions.map((questionNumber) => {
                          const maxMarks = marksPerAssignedQuestion[questionNumber] ?? 0;
                          const currentMarks = marks[questionNumber.toString()] ?? null;
                          const isGraded = currentMarks !== null;
                          const markOptions = Array.from({ length: maxMarks + 1 }, (_, i) => i);

                          return (
                            <div
                              key={questionNumber}
                              className={`p-2 border rounded transition-all text-xs ${selectedQuestion === questionNumber
                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                : isGraded
                                  ? "border-green-500 bg-green-50"
                                  : "border-border hover:bg-muted/50"
                                }`}
                              onClick={() => setSelectedQuestion(questionNumber)}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <Label className="font-semibold text-xs cursor-pointer">
                                  Q{questionNumber}
                                </Label>
                                {isGraded && (
                                  <CheckCircle2 className="w-3 h-3 text-green-600" />
                                )}
                              </div>
                              <Select
                                value={currentMarks !== null ? currentMarks.toString() : "none"}
                                onValueChange={(value) => {
                                  if (value !== "none") {
                                    handleQuestionMarks(questionNumber, parseInt(value));
                                  }
                                }}
                              >
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue placeholder="Select marks" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Not graded</SelectItem>
                                  {markOptions.map((mark) => (
                                    <SelectItem key={mark} value={mark.toString()}>
                                      {mark} / {maxMarks}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {isGraded && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {currentMarks} / {maxMarks}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </CardContent>
                  {/* Summary Footer */}
                  <div className="border-t p-3 bg-muted/50">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-medium">Total:</span>
                      <span className="text-sm font-bold">{totalObtainedMarks}</span>
                    </div>
                    <Button
                      onClick={handleSavePaper}
                      disabled={assignedQuestions.length === 0}
                      className="w-full h-8 text-xs"
                      size="sm"
                    >
                      <Save className="w-3 h-3 mr-1" />
                      Submit
                    </Button>
                  </div>
                </Card>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0 shadow-lg self-start mt-4"
                  onClick={() => setIsQuestionsSidebarOpen(true)}
                >
                  <Menu className="h-4 w-4" />
                </Button>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground bg-muted/30 rounded-lg">
              <div className="text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a paper to start grading</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaperCheckingInterface;