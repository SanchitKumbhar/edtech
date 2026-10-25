import { useMemo, useState } from "react";
import {
  Loader2,
  BookOpen,
  PlusCircle,
  Trash2,
  FileText,
  Clock,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

type PyqQuestion = {
  _id?: string;
  questionNo: number;
  questionText: string;
  options: Array<{ label: string; text: string }>;
  correctOption: "A" | "B" | "C" | "D";
  explanation?: string;
  marks?: number;
};

type PyqSet = {
  _id: string;
  title: string;
  examName: string;
  examYear: number;
  subject?: string;
  description?: string;
  paperUrl?: string;
  pdfFileName?: string;
  pdfData?: string;
  durationMinutes?: number;
  totalMarks?: number;
  questions?: PyqQuestion[];
  isPublished?: boolean;
};

export default function PYQSection() {
  const user = getStoredUser();
  const isAdmin = user?.role === "admin";
  const queryClient = useQueryClient();

  const [yearFilter, setYearFilter] = useState<string>("all");
  const [examFilter, setExamFilter] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const handleOpenPdf = (set: PyqSet) => {
    if (set.pdfData) {
      const newWin = window.open();
      if (newWin) {
        newWin.document.write(
          `<!DOCTYPE html><html><head><title>${set.pdfFileName || set.title}</title><style>html,body{margin:0;padding:0;height:100%;overflow:hidden;background:#1e1e1e;}</style></head><body><iframe src="${set.pdfData}" frameborder="0" style="width:100%; height:100%; border:none;" allowfullscreen></iframe></body></html>`
        );
      }
    } else if (set.paperUrl) {
      window.open(set.paperUrl, "_blank");
    } else {
      alert("No PDF paper has been uploaded for this PYQ set yet.");
    }
  };

  // New PYQ form state
  const [newTitle, setNewTitle] = useState("");
  const [newExamName, setNewExamName] = useState("JEE Main");
  const [newExamYear, setNewExamYear] = useState<number>(new Date().getFullYear());
  const [newSubject, setNewSubject] = useState("Physics");
  const [newDescription, setNewDescription] = useState("");
  const [newPaperUrl, setNewPaperUrl] = useState("");
  const [newDuration, setNewDuration] = useState<number>(180);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfFileName, setPdfFileName] = useState("");
  const [pdfBase64, setPdfBase64] = useState("");
  const [pdfError, setPdfError] = useState("");

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setPdfError("");
    if (!file) {
      setPdfFile(null);
      setPdfFileName("");
      setPdfBase64("");
      return;
    }
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setPdfError("Only PDF files are allowed (.pdf).");
      setPdfFile(null);
      setPdfFileName("");
      setPdfBase64("");
      e.target.value = "";
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setPdfError("PDF file size must be less than 20MB.");
      setPdfFile(null);
      setPdfFileName("");
      setPdfBase64("");
      e.target.value = "";
      return;
    }
    setPdfFile(file);
    setPdfFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setPdfBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const { data: pyqSets = [], isLoading } = useQuery<PyqSet[]>({
    queryKey: ["pyqSets"],
    queryFn: () => apiRequest<PyqSet[]>("/pyq"),
  });

  const years = useMemo(() => {
    const y = Array.from(new Set(pyqSets.map((s) => s.examYear).filter(Boolean))) as number[];
    return y.sort((a, b) => b - a);
  }, [pyqSets]);

  const examNames = useMemo(() => {
    const names = Array.from(new Set(pyqSets.map((s) => s.examName).filter(Boolean))) as string[];
    return names.sort();
  }, [pyqSets]);

  const filtered = pyqSets.filter((set) => {
    const yearMatch = yearFilter === "all" || String(set.examYear || "") === yearFilter;
    const examMatch = examFilter === "all" || (set.examName || "") === examFilter;
    return yearMatch && examMatch;
  });

  const createPyqMutation = useMutation({
    mutationFn: () =>
      apiRequest("/pyq", {
        method: "POST",
        body: {
          title: newTitle,
          examName: newExamName,
          examYear: Number(newExamYear),
          subject: newSubject,
          description: newDescription,
          paperUrl: newPaperUrl,
          pdfFileName: pdfFileName || undefined,
          pdfData: pdfBase64 || undefined,
          durationMinutes: Number(newDuration),
          isPublished: true,
          questions: [
            {
              questionNo: 1,
              questionText: `Sample question for ${newTitle}`,
              options: [
                { label: "A", text: "Option A" },
                { label: "B", text: "Option B" },
                { label: "C", text: "Option C" },
                { label: "D", text: "Option D" },
              ],
              correctOption: "A",
              explanation: "Foundational conceptual question for this past year exam.",
              marks: 4,
            },
          ],
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pyqSets"] });
      setCreateDialogOpen(false);
      setNewTitle("");
      setNewDescription("");
      setNewPaperUrl("");
      setPdfFile(null);
      setPdfFileName("");
      setPdfBase64("");
      setPdfError("");
    },
  });

  const deletePyqMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/pyq/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pyqSets"] });
    },
  });

  const togglePublishMutation = useMutation({
    mutationFn: ({ id, isPublished }: { id: string; isPublished: boolean }) =>
      apiRequest(`/pyq/${id}`, {
        method: "PUT",
        body: { isPublished },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pyqSets"] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-primary" /> Previous Year Questions (PYQ)
          </h1>
          <p className="text-muted-foreground mt-1">
            Browse official previous year question papers and open the PDF directly
          </p>
        </div>

        {isAdmin && (
          <Button onClick={() => setCreateDialogOpen(true)} className="gradient-primary text-primary-foreground">
            <PlusCircle className="w-4 h-4 mr-2" /> Add PYQ Set
          </Button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="h-10 rounded-xl border border-input/80 bg-background/70 backdrop-blur-md px-3.5 text-sm min-w-[130px] font-medium shadow-sm focus:ring-2 focus:ring-primary/30 outline-none"
        >
          <option value="all">All Years</option>
          {years.map((year) => (
            <option key={year} value={String(year)}>
              {year}
            </option>
          ))}
        </select>

        <select
          value={examFilter}
          onChange={(e) => setExamFilter(e.target.value)}
          className="h-10 rounded-xl border border-input/80 bg-background/70 backdrop-blur-md px-3.5 text-sm min-w-[180px] font-medium shadow-sm focus:ring-2 focus:ring-primary/30 outline-none"
        >
          <option value="all">All Exams</option>
          {examNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <span className="text-xs font-medium text-muted-foreground ml-auto bg-muted/60 px-3 py-1.5 rounded-full border border-border/50">
          Showing {filtered.length} paper{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Grid of PYQs */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.length ? (
          filtered.map((set) => (
            <div
              key={set._id}
              className="glass-card rounded-3xl p-6 flex flex-col justify-between border border-white/40 dark:border-white/10 hover:border-primary/50 transition-all duration-300 group shadow-lg hover:shadow-xl hover:-translate-y-1"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider bg-primary/15 text-primary border border-primary/20 px-3 py-0.5 rounded-full">
                    {set.examName || "Exam"}
                  </span>
                  <span className="text-xs font-bold text-muted-foreground">{set.examYear}</span>
                </div>

                <h3 className="font-bold text-lg leading-snug group-hover:text-primary transition-colors">
                  {set.title || "Untitled Paper"}
                </h3>

                <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                  {set.description || `Official questions from ${set.examName} ${set.examYear} on ${set.subject}.`}
                </p>

                <div className="flex items-center gap-4 mt-5 pt-3 border-t border-border/50 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1 font-medium">
                    <FileText className="w-3.5 h-3.5 text-primary" />
                    {set.questions?.length || 1} questions
                  </span>
                  <span className="flex items-center gap-1 font-medium">
                    <Clock className="w-3.5 h-3.5 text-indigo-500" />
                    {set.durationMinutes || 180} min
                  </span>
                  <span className="ml-auto font-semibold text-foreground px-2 py-0.5 rounded-md bg-muted/70 text-[11px]">{set.subject}</span>
                </div>
              </div>

              <div className="mt-6 pt-3.5 border-t border-border/40 flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  className="flex-1 gradient-primary text-primary-foreground text-xs font-bold rounded-xl py-2 shadow-md shadow-primary/20"
                  onClick={() => handleOpenPdf(set)}
                  title={set.pdfFileName ? `Open ${set.pdfFileName}` : "Open PDF"}
                >
                  <FileText className="w-3.5 h-3.5 mr-1.5" /> Open PDF
                </Button>

                {isAdmin && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs px-2.5 rounded-xl hover:bg-muted"
                      onClick={() =>
                        togglePublishMutation.mutate({ id: set._id, isPublished: !set.isPublished })
                      }
                    >
                      {set.isPublished ? "Unpublish" : "Publish"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive px-2.5 rounded-xl hover:bg-destructive/10"
                      onClick={() => {
                        if (confirm(`Delete "${set.title}"?`)) {
                          deletePyqMutation.mutate(set._id);
                        }
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-16 text-center text-muted-foreground glass-panel rounded-3xl border border-dashed border-border">
            No PYQ sets found matching your filter criteria.
          </div>
        )}
      </div>



      {/* Admin Add PYQ Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Previous Year Question Paper</DialogTitle>
            <DialogDescription>Create a new PYQ set for students to practice.</DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              createPyqMutation.mutate();
            }}
            className="space-y-4 text-sm"
          >
            <div>
              <Label>Paper Title *</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g., JEE Advanced 2024 Paper 1"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Exam Name *</Label>
                <Input
                  value={newExamName}
                  onChange={(e) => setNewExamName(e.target.value)}
                  placeholder="e.g. JEE Main, NEET"
                  required
                />
              </div>
              <div>
                <Label>Exam Year *</Label>
                <Input
                  type="number"
                  value={newExamYear}
                  onChange={(e) => setNewExamYear(Number(e.target.value))}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Subject</Label>
                <Input
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="e.g. Physics"
                />
              </div>
              <div>
                <Label>Duration (Minutes)</Label>
                <Input
                  type="number"
                  value={newDuration}
                  onChange={(e) => setNewDuration(Number(e.target.value))}
                />
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Highlights or syllabus coverage"
                rows={2}
              />
            </div>

            <div className="space-y-1.5 p-3 rounded-lg border border-border/80 bg-background/50">
              <Label htmlFor="pyq-pdf-file" className="font-semibold flex items-center justify-between">
                <span>Upload PYQ Paper (PDF Only)</span>
                <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded font-mono">.pdf</span>
              </Label>
              <Input
                id="pyq-pdf-file"
                type="file"
                accept=".pdf,application/pdf"
                onChange={handlePdfChange}
                className="cursor-pointer file:cursor-pointer file:font-semibold"
              />
              {pdfFileName ? (
                <div className="flex items-center justify-between text-xs text-primary font-medium bg-primary/10 px-2.5 py-1.5 rounded border border-primary/20">
                  <span className="truncate flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> {pdfFileName}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setPdfFile(null);
                      setPdfFileName("");
                      setPdfBase64("");
                    }}
                    className="text-destructive hover:underline ml-2"
                  >
                    Remove
                  </button>
                </div>
              ) : null}
              {pdfError ? (
                <p className="text-xs text-destructive font-medium">{pdfError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Strictly PDF documents only. Max size 20MB.
                </p>
              )}
            </div>

            <div>
              <Label>Official Portal / Resource URL (Optional)</Label>
              <Input
                value={newPaperUrl}
                onChange={(e) => setNewPaperUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreateDialogOpen(false);
                  setPdfFile(null);
                  setPdfFileName("");
                  setPdfBase64("");
                  setPdfError("");
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createPyqMutation.isPending} className="gradient-primary">
                {createPyqMutation.isPending ? "Creating..." : "Create Paper"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

