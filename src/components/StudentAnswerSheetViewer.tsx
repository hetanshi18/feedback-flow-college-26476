import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Document, Page, pdfjs } from 'react-pdf';
import { Canvas as FabricCanvas } from 'fabric';
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
  const canvasRefs = useRef<{ [key: number]: HTMLCanvasElement | null }>({});
  const fabricCanvases = useRef<{ [key: number]: FabricCanvas | null }>({});

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

  const initializeCanvas = (pageNum: number) => {
    const canvasEl = canvasRefs.current[pageNum];
    if (!canvasEl || fabricCanvases.current[pageNum]) return;
    
    const canvas = new FabricCanvas(canvasEl, {
      isDrawingMode: false,
      selection: false,
      width: 800,
      height: 1100,
    });
    
    // Make canvas read-only for students
    canvas.selection = false;
    
    fabricCanvases.current[pageNum] = canvas;
    
    // Load annotations for this page
    const pageAnnotations = annotations.filter(ann => ann.page_number === pageNum);
    pageAnnotations.forEach((ann: any) => {
      try {
        const content = JSON.parse(ann.content);
        // Recreate the annotation object on the canvas
        // This is simplified - full implementation would need to handle different object types
      } catch (error) {
        console.error('Error loading annotation:', error);
      }
    });
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

          <div className="relative border rounded-lg overflow-hidden bg-white">
            <Document
              file={getPdfUrl(answerSheet?.file_url)}
              onLoadSuccess={onDocumentLoadSuccess}
              className="flex justify-center"
            >
              <Page
                pageNumber={pageNumber}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                onRenderSuccess={() => initializeCanvas(pageNumber)}
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
      </DialogContent>
    </Dialog>
  );
};

export default StudentAnswerSheetViewer;
