import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { Document, Page, pdfjs } from 'react-pdf';
import { Canvas as FabricCanvas, util, FabricObject } from 'fabric';
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface StudentAnswerSheetViewerProps {
  answerSheet: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const StudentAnswerSheetViewer = ({ answerSheet, open, onOpenChange }: StudentAnswerSheetViewerProps) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [annotations, setAnnotations] = useState<any[]>([]);
  const [pageWidth, setPageWidth] = useState<number>(800);
  const [pageHeight, setPageHeight] = useState<number>(1100);
  const [questionMarks, setQuestionMarks] = useState<any[]>([]);
  const canvasRefs = useRef<{ [key: number]: HTMLCanvasElement | null }>({});
  const fabricCanvases = useRef<{ [key: number]: FabricCanvas | null }>({});
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && answerSheet) {
      loadAnnotations();
      loadQuestionMarks();
    }
  }, [open, answerSheet]);

  const loadAnnotations = async () => {
    if (!answerSheet) return;
    
    try {
      const { data, error } = await supabase
        .from('answer_sheet_annotations')
        .select('*')
        .eq('answer_sheet_id', answerSheet.id);
      
      if (error) throw error;
      setAnnotations(data || []);
    } catch (error) {
      console.error('Error loading annotations:', error);
    }
  };

  const loadQuestionMarks = async () => {
    if (!answerSheet) return;
    
    try {
      const { data, error } = await supabase
        .from('answer_sheet_questions')
        .select('*')
        .eq('answer_sheet_id', answerSheet.id)
        .order('question_number', { ascending: true });
      
      if (error) throw error;
      setQuestionMarks(data || []);
    } catch (error) {
      console.error('Error loading question marks:', error);
    }
  };

  const getPdfUrl = (fileUrl: string) => {
    if (!fileUrl) return '/sample-answer-sheet.pdf';
    if (fileUrl.startsWith('http')) return fileUrl;
    
    const { data } = supabase.storage
      .from('answer-sheets')
      .getPublicUrl(fileUrl);
    
    return data.publicUrl;
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
  };

  const initializeCanvas = async (pageNum: number) => {
    const canvasEl = canvasRefs.current[pageNum];
    if (!canvasEl) return;
    
    // Dispose existing canvas if it exists
    if (fabricCanvases.current[pageNum]) {
      fabricCanvases.current[pageNum]?.dispose();
      fabricCanvases.current[pageNum] = null;
    }
    
    // Set dimensions explicitly
    canvasEl.width = pageWidth;
    canvasEl.height = pageHeight;

    const canvas = new FabricCanvas(canvasEl, {
      isDrawingMode: false,
      selection: false,
      width: pageWidth,
      height: pageHeight,
      backgroundColor: 'transparent'
    });
    
    fabricCanvases.current[pageNum] = canvas;
    
    // Load annotations for this page
    const pageAnnotations = annotations.filter(ann => ann.page_number === pageNum);
    for (const ann of pageAnnotations) {
      try {
        const content = JSON.parse(ann.content);
        
        // Fabric.js enlivens individual objects
        const enlivened = await util.enlivenObjects([content]);
        if (enlivened && enlivened[0]) {
          const obj = enlivened[0] as FabricObject;
          obj.selectable = false;
          obj.evented = false;
          canvas.add(obj);
        }
        
        canvas.renderAll();
      } catch (error) {
        console.error('Error loading annotation:', error);
      }
    }
  };

  // Group questions by question number (handling sub-questions)
  const groupedQuestions = questionMarks.reduce((acc, q) => {
    const key = q.question_number;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(q);
    return acc;
  }, {} as Record<number, any[]>);

  const totalObtained = questionMarks.reduce((sum, q) => sum + (q.obtained_marks || 0), 0);
  const totalMax = questionMarks.reduce((sum, q) => sum + (q.max_marks || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-fit max-w-[95vw] max-h-[90vh] p-0 flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
          <DialogTitle>
            {answerSheet?.exam?.subject?.name} - {answerSheet?.exam?.name}
          </DialogTitle>
          <div className="text-sm text-muted-foreground">
            Score: {answerSheet?.obtained_marks || 0}/{answerSheet?.total_marks || 0}
          </div>
        </DialogHeader>
        
        <div className="flex flex-1 overflow-hidden">
          {/* PDF Viewer Section - Constrained Width */}
          <div className="w-[800px] overflow-y-auto p-6 flex-shrink-0">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Button
                  onClick={() => setPageNumber(prev => Math.max(1, prev - 1))}
                  disabled={pageNumber <= 1}
                  size="sm"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm">
                  Page {pageNumber} of {numPages}
                </span>
                <Button
                  onClick={() => setPageNumber(prev => Math.min(numPages, prev + 1))}
                  disabled={pageNumber >= numPages}
                  size="sm"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div ref={pdfContainerRef} className="border rounded-lg overflow-hidden bg-white">
                <div className="flex justify-center relative inline-block">
                  <Document
                    file={getPdfUrl(answerSheet?.file_url)}
                    onLoadSuccess={onDocumentLoadSuccess}
                  >
                    <Page
                      pageNumber={pageNumber}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      onRenderSuccess={(page) => {
                        const viewport = page.getViewport({ scale: 1 });
                        setPageWidth(viewport.width);
                        setPageHeight(viewport.height);
                        setTimeout(() => initializeCanvas(pageNumber), 100);
                      }}
                    />
                  </Document>
                  <div 
                    className="absolute top-0 left-0 z-50 pointer-events-none"
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
          </div>

          {/* Sidebar for Question-wise Marks */}
          <div className="w-[240px] border-l bg-muted/30 flex flex-col flex-shrink-0">
            <div className="p-4 border-b bg-background">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Question-wise Marks
              </h3>
              {questionMarks.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Total: {totalObtained.toFixed(2)}/{totalMax.toFixed(2)}
                </p>
              )}
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-2">
                {questionMarks.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <p className="text-xs">No question marks available yet.</p>
                    <p className="text-xs mt-1">Marks will appear here once your paper is graded.</p>
                  </div>
                ) : (
                  Object.keys(groupedQuestions)
                    .sort((a, b) => Number(a) - Number(b))
                    .map((qNum) => {
                      const questions = groupedQuestions[Number(qNum)];
                      const questionTotal = questions.reduce((sum, q) => sum + (q.obtained_marks || 0), 0);
                      const questionMax = questions.reduce((sum, q) => sum + (q.max_marks || 0), 0);
                      
                      return (
                        <Card key={qNum} className="overflow-hidden">
                          <CardHeader className="pb-2 pt-3 px-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm">
                                Q{qNum}
                              </CardTitle>
                              <Badge variant="secondary" className="text-xs font-semibold">
                                {questionTotal.toFixed(2)}/{questionMax.toFixed(2)}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0 px-3 pb-3 space-y-1.5">
                            {questions.map((q, idx) => (
                              <div
                                key={q.id || idx}
                                className="p-1.5 rounded border bg-muted/30"
                              >
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="text-xs font-medium">
                                    {q.sub_question ? `(${q.sub_question})` : 'Main'}
                                  </span>
                                  <span className="text-xs font-semibold">
                                    {q.obtained_marks?.toFixed(2) || '0.00'}/{q.max_marks?.toFixed(2) || '0.00'}
                                  </span>
                                </div>
                                {q.comments && (
                                  <p className="text-xs text-muted-foreground mt-0.5 italic line-clamp-2">
                                    "{q.comments}"
                                  </p>
                                )}
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      );
                    })
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StudentAnswerSheetViewer;
