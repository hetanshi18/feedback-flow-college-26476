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

const PaperCheckingInterface = () => {
  const { user } = useAuth();
  const canvasRefs = useRef<{ [key: number]: HTMLCanvasElement | null }>({});
  const fabricCanvases = useRef<{ [key: number]: FabricCanvas | null }>({});
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
  const mapFabricTypeToDbType = (fabricType: string): string => {
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
              annotation_type: mapFabricTypeToDbType(obj.type || "path"),
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
    if (!canvasEl) return;

    // Ensure canvas element matches PDF page size
    canvasEl.width = pageWidth;
    canvasEl.height = pageHeight;
    canvasEl.style.width = `${pageWidth}px`;
    canvasEl.style.height = `${pageHeight}px`;

    // Dispose existing canvas if present to avoid stacking
    if (fabricCanvases.current[pageNum]) {
      fabricCanvases.current[pageNum]?.dispose();
      fabricCanvases.current[pageNum] = null;
    }

    const fabricCanvas = new FabricCanvas(canvasEl, {
      isDrawingMode: activeTool === "pen" || activeTool === "eraser",
      width: pageWidth,
      height: pageHeight,
      selection: true,
    });

    if (fabricCanvas.freeDrawingBrush) {
      fabricCanvas.freeDrawingBrush.color =
        activeTool === "eraser" ? "#FFFFFF" : annotationColor;
      fabricCanvas.freeDrawingBrush.width = activeTool === "eraser" ? 20 : 2;
    }

    // Click handler: place preset annotations at exact click point
    fabricCanvas.on("mouse:down", (opt: any) => {
      const pointer = fabricCanvas.getPointer(opt.e);
      const x = pointer.x;
      const y = pointer.y;
      if (activeTool === "tick") addPresetAnnotation("tick", x, y);
      if (activeTool === "cross") addPresetAnnotation("cross", x, y);
      if (activeTool === "oval") addPresetAnnotation("oval", x, y);
      if (activeTool === "textbox") addPresetAnnotation("textbox", x, y);
    });

    fabricCanvases.current[pageNum] = fabricCanvas;

    // Load existing annotations for this page (future: reconstruct from DB)
    const pageAnnotations = annotations.filter(
      (ann) => ann.page_number === pageNum
    );
  };

  const addPresetAnnotation = (
    type: "tick" | "cross" | "oval" | "textbox",
    atX?: number,
    atY?: number
  ) => {
    const canvas = fabricCanvases.current[pageNumber];
    if (!canvas) return;

    const redColor = "#FF0000";
    const centerX = atX ?? canvas.width! / 2;
    const centerY = atY ?? canvas.height! / 2;

    switch (type) {
      case "tick":
        // Draw a checkmark using Path
        const tickPath = new Path("M 10 50 L 40 80 L 90 20", {
          stroke: redColor,
          strokeWidth: 6,
          fill: "",
          left: centerX - 50,
          top: centerY - 50,
          selectable: true,
          strokeLineCap: "round",
          strokeLineJoin: "round",
        });
        canvas.add(tickPath);
        break;

      case "cross":
        // Draw an X using two paths
        const crossPath1 = new Path("M 20 20 L 80 80", {
          stroke: redColor,
          strokeWidth: 6,
          fill: "",
          left: centerX - 50,
          top: centerY - 50,
          selectable: true,
          strokeLineCap: "round",
        });
        const crossPath2 = new Path("M 80 20 L 20 80", {
          stroke: redColor,
          strokeWidth: 6,
          fill: "",
          left: centerX - 50,
          top: centerY - 50,
          selectable: true,
          strokeLineCap: "round",
        });
        canvas.add(crossPath1, crossPath2);
        break;

      case "oval":
        // Draw an oval/ellipse
        const oval = new Ellipse({
          left: centerX - 40,
          top: centerY - 30,
          rx: 40,
          ry: 30,
          fill: "transparent",
          stroke: redColor,
          strokeWidth: 3,
          selectable: true,
        });
        canvas.add(oval);
        break;

      case "textbox":
        // Add an editable text box
        const textbox = new IText("Text", {
          left: centerX - 50,
          top: centerY - 20,
          fill: redColor,
          fontSize: 24,
          fontFamily: "Arial",
          selectable: true,
          editable: true,
        });
        canvas.add(textbox);
        canvas.setActiveObject(textbox);
        textbox.enterEditing();
        break;
    }

    canvas.renderAll();
  };

  useEffect(() => {
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
    setPageNumber((prevPageNumber) =>
      Math.min(Math.max(prevPageNumber + offset, 1), numPages)
    );
  };

  const changeScale = (newScale: number) => {
    setScale(Math.min(Math.max(newScale, 0.5), 3.0));
  };

  const handleQuestionMarks = (questionNumber: string, marks: number) => {
    setMarks((prev) => ({ ...prev, [questionNumber]: marks }));
    calculateTotal();
  };

  const handleQuestionComment = (questionNumber: string, comment: string) => {
    setComments((prev) => ({ ...prev, [questionNumber]: comment }));
  };

  const calculateTotal = () => {
    const total = Object.values(marks).reduce((sum, mark) => sum + mark, 0);
    setTotalObtainedMarks(total);
  };

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

      // Save individual question marks
      const questionMarks = Object.entries(marks).map(
        ([questionNumber, obtainedMarks]) => ({
          answer_sheet_id: selectedPaper.id,
          question_number: parseInt(questionNumber),
          obtained_marks: obtainedMarks,
          max_marks: 10, // Default max marks per question
          graded_by: currentTeacherId,
          graded_at: new Date().toISOString(),
          comments: comments[questionNumber] || null,
        })
      );

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
                        variant="outline"
                        onClick={() => {
                          setActiveTool("tick");
                        }}
                        title="Add Tick Mark (Red)"
                        className="text-red-600 hover:text-red-700"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setActiveTool("cross");
                        }}
                        title="Add Cross Mark (Red)"
                        className="text-red-600 hover:text-red-700"
                      >
                        <XIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setActiveTool("oval");
                        }}
                        title="Add Oval (Red)"
                        className="text-red-600 hover:text-red-700"
                      >
                        <CircleIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setActiveTool("textbox");
                        }}
                        title="Add Text Box (Red)"
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
                          <div
                            className="relative"
                            style={{ width: pageWidth, height: pageHeight }}
                          >
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
                                  // Initialize after DOM updates
                                  setTimeout(
                                    () => initializeFabricCanvas(pageNumber),
                                    0
                                  );
                                }}
                              />
                            </Document>
                            <canvas
                              ref={(el) => {
                                if (el) canvasRefs.current[pageNumber] = el;
                              }}
                              className="absolute top-0 left-0 pointer-events-auto"
                              style={{ zIndex: 10 }}
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
                    Enter marks and comments for each question
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Quick grade inputs for common questions */}
                    <ScrollArea className="h-96 pr-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Array.from({ length: 20 }, (_, i) => i + 1).map(
                          (questionNumber) => (
                            <div key={questionNumber} className="space-y-2">
                              <Label>Question {questionNumber}</Label>
                              <div className="flex gap-2">
                                <Input
                                  type="number"
                                  placeholder="Marks"
                                  value={marks[questionNumber] || ""}
                                  onChange={(e) =>
                                    handleQuestionMarks(
                                      questionNumber.toString(),
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className="w-20"
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
                          )
                        )}
                      </div>
                    </ScrollArea>

                    <div className="flex justify-between items-center pt-4 border-t">
                      <div className="text-lg font-semibold">
                        Total Marks: {totalObtainedMarks} /{" "}
                        {selectedPaper.total_marks || 100}
                      </div>
                      <Button
                        onClick={handleSavePaper}
                        className="flex items-center gap-2"
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
                  Select a paper from the list to start grading, or view the
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
      </div>
    </div>
  );
};

export default PaperCheckingInterface;
