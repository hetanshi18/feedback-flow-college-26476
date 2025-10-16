import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Document, Page, pdfjs } from 'react-pdf';
import { Canvas as FabricCanvas, util, FabricObject } from 'fabric';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
  const canvasRefs = useRef<{ [key: number]: HTMLCanvasElement | null }>({});
  const fabricCanvases = useRef<{ [key: number]: FabricCanvas | null }>({});
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && answerSheet) {
      loadAnnotations();
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
    
    const canvas = new FabricCanvas(canvasEl, {
      isDrawingMode: false,
      selection: false,
      width: pageWidth,
      height: pageHeight,
    });
    
    // Make canvas read-only for students
    canvas.selection = false;
    canvas.forEachObject((obj) => {
      obj.selectable = false;
      obj.evented = false;
    });
    
    fabricCanvases.current[pageNum] = canvas;
    
    // Load annotations for this page
    const pageAnnotations = annotations.filter(ann => ann.page_number === pageNum);
    for (const ann of pageAnnotations) {
      try {
        const content = JSON.parse(ann.content);
        
        // Load the Fabric.js objects from the saved JSON
        if (content.objects) {
          for (const objData of content.objects) {
            const enlivened = await util.enlivenObjects([objData]);
            if (enlivened && enlivened[0] instanceof FabricObject) {
              const obj = enlivened[0] as FabricObject;
              obj.selectable = false;
              obj.evented = false;
              canvas.add(obj);
            }
          }
        }
        
        canvas.renderAll();
      } catch (error) {
        console.error('Error loading annotation:', error);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {answerSheet?.exam?.subject?.name} - {answerSheet?.exam?.name}
          </DialogTitle>
          <div className="text-sm text-muted-foreground">
            Score: {answerSheet?.obtained_marks || 0}/{answerSheet?.total_marks || 0}
          </div>
        </DialogHeader>
        
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

          <div ref={pdfContainerRef} className="relative border rounded-lg overflow-hidden bg-white flex justify-center">
            <div className="relative">
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
              <canvas
                ref={(el) => {
                  if (el) canvasRefs.current[pageNumber] = el;
                }}
                className="absolute top-0 left-0 pointer-events-none"
                style={{ zIndex: 10 }}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StudentAnswerSheetViewer;
