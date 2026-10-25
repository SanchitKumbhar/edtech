import { useState } from "react";
import { Users, FileText, Activity, PlusCircle, Upload, Bell, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

type AdminDashboardData = {
  stats: {
    totalStudents: number;
    activeExams: number;
    ongoingSessions: number;
  };
  recentExams: any[];
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case "live":
      return "bg-success/10 text-success";
    case "completed":
      return "bg-muted text-muted-foreground";
    case "scheduled":
      return "bg-primary/10 text-primary";
    default:
      return "bg-warning/10 text-warning";
  }
};

export default function AdminDashboard() {
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  const { data: dashboardData, isLoading, error } = useQuery<AdminDashboardData>({
    queryKey: ["adminDashboard"],
    queryFn: () => apiRequest<AdminDashboardData>("/dashboard/admin"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-destructive">Failed to load dashboard. Please refresh.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl animate-fade-in pb-12">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Admin Dashboard 🛠️</h1>
        <p className="text-muted-foreground mt-1 text-sm">Real-time overview of examinations, candidates, and institute operations</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {[
          { label: "Total Students", value: dashboardData.stats.totalStudents, icon: Users, color: "gradient-primary" },
          { label: "Active Exams", value: dashboardData.stats.activeExams, icon: FileText, color: "gradient-success" },
          { label: "Ongoing Sessions", value: dashboardData.stats.ongoingSessions, icon: Activity, color: "gradient-accent" },
        ].map((s) => (
          <div key={s.label} className="stat-card rounded-2xl p-6 border border-white/40 dark:border-white/10 flex items-center gap-5 shadow-lg">
            <div className={`w-14 h-14 rounded-2xl ${s.color} flex items-center justify-center shrink-0 shadow-md`}>
              <s.icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-3xl font-extrabold tracking-tight">{s.value}</p>
              <p className="text-xs font-medium text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Link to="/admin/create-exam">
          <Button className="gradient-primary text-primary-foreground font-semibold rounded-xl shadow-md shadow-primary/25 px-5">
            <PlusCircle className="w-4 h-4 mr-2" /> Create Exam
          </Button>
        </Link>
        <Link to="/admin/exam-scores">
          <Button variant="outline" className="glass-card rounded-xl border-border/80 font-medium">
            <FileText className="w-4 h-4 mr-2 text-primary" /> Submitted Exam Scores
          </Button>
        </Link>
        <Link to="/admin/create-practice">
          <Button variant="outline" className="glass-card rounded-xl border-border/80 font-medium">
            <PlusCircle className="w-4 h-4 mr-2 text-primary" /> Create Practice Questions
          </Button>
        </Link>
        <Button variant="outline" className="glass-card rounded-xl border-border/80 font-medium" onClick={() => setUploadModalOpen(true)}>
          <Upload className="w-4 h-4 mr-2 text-primary" /> Upload Questions
        </Button>
        <Link to="/admin/post-notice">
          <Button variant="outline" className="glass-card rounded-xl border-border/80 font-medium">
            <Bell className="w-4 h-4 mr-2 text-primary" /> Post Notice
          </Button>
        </Link>
      </div>

      {/* Exam Table */}
      <div className="glass-panel rounded-3xl p-6 md:p-8 border border-white/50 dark:border-white/10 shadow-xl space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-xl tracking-tight">Recent Examinations</h2>
          <span className="text-xs font-medium text-muted-foreground bg-muted/60 px-3 py-1 rounded-full border border-border/40">
            Latest {dashboardData.recentExams.slice(0, 10).length} exams
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border/60">
                <th className="pb-3 font-semibold text-xs uppercase tracking-wider">Exam Title</th>
                <th className="pb-3 font-semibold text-xs uppercase tracking-wider">Type</th>
                <th className="pb-3 font-semibold text-xs uppercase tracking-wider">Status</th>
                <th className="pb-3 font-semibold text-xs uppercase tracking-wider">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {dashboardData.recentExams.slice(0, 10).map((e) => (
                <tr key={e._id} className="hover:bg-muted/30 transition-colors">
                  <td className="py-3.5 font-semibold text-foreground">{e.title}</td>
                  <td className="py-3.5 text-muted-foreground">{e.examType || "Standard"}</td>
                  <td className="py-3.5">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-border/40 ${getStatusColor(e.status)}`}>
                      {e.status.charAt(0).toUpperCase() + e.status.slice(1)}
                    </span>
                  </td>
                  <td className="py-3.5 text-muted-foreground font-medium">{e.durationMinutes} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Questions Modal */}
      <QuickUploadQuestionsDialog
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
      />
    </div>
  );
}

function QuickUploadQuestionsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [classLevel, setClassLevel] = useState("Class 11");
  const [subject, setSubject] = useState("Physics");
  const [topicName, setTopicName] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [csvContent, setCsvContent] = useState("");
  const [statusMessage, setStatusMessage] = useState<{ text: string; error: boolean } | null>(null);

  const { data: topics = [] } = useQuery<Array<{ _id: string; topicName: string }>>({
    queryKey: ["quickUploadTopics", classLevel, subject],
    queryFn: () =>
      apiRequest<Array<{ _id: string; topicName: string }>>(
        `/practice/topics?classLevel=${encodeURIComponent(classLevel)}&subject=${encodeURIComponent(subject)}`
      ),
    enabled: open,
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      setStatusMessage(null);
      if (!csvContent.trim()) {
        throw new Error("Please select or paste CSV question lines.");
      }

      // Check if topic exists or create it
      let targetTopic = topics.find((t) => t.topicName.toLowerCase() === topicName.trim().toLowerCase());
      let topicId = targetTopic?._id;

      if (!topicId) {
        if (!topicName.trim()) {
          throw new Error("Please provide or select a Topic name.");
        }
        const created = await apiRequest<{ _id: string }>("/practice/topics", {
          method: "POST",
          body: {
            classLevel,
            subject,
            topicName: topicName.trim(),
            isActive: true,
          },
        });
        topicId = created._id;
      }

      // Parse CSV lines
      const lines = csvContent
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      const questionsToUpload: any[] = [];
      const isHeader = (line: string) => line.toLowerCase().includes("question");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (i === 0 && isHeader(line)) continue;

        // Simple comma split respecting quotes
        const parts = line.split(",").map((s) => s.replace(/^"|"$/g, "").trim());
        if (parts.length >= 6) {
          const [qText, optA, optB, optC, optD, correct] = parts;
          const upperCorrect = correct.toUpperCase() as "A" | "B" | "C" | "D";
          if (["A", "B", "C", "D"].includes(upperCorrect)) {
            questionsToUpload.push({
              topicId,
              difficulty,
              questionText: qText,
              options: [optA, optB, optC, optD],
              correctOption: upperCorrect,
              pointsReward: difficulty === "hard" ? 40 : difficulty === "medium" ? 25 : 15,
            });
          }
        }
      }

      if (questionsToUpload.length === 0) {
        throw new Error("No valid question rows found. Format: Question,OptionA,OptionB,OptionC,OptionD,CorrectOption");
      }

      const res = await apiRequest<any>("/practice/questions/bulk", {
        method: "POST",
        body: { questions: questionsToUpload },
      });

      return { count: questionsToUpload.length, res };
    },
    onSuccess: (data) => {
      setStatusMessage({ text: `Successfully uploaded ${data.count} questions!`, error: false });
      queryClient.invalidateQueries({ queryKey: ["adminPracticeQuestions"] });
      queryClient.invalidateQueries({ queryKey: ["quickUploadTopics"] });
      setCsvContent("");
      setTimeout(() => {
        onOpenChange(false);
      }, 1500);
    },
    onError: (err: Error) => {
      setStatusMessage({ text: err.message, error: true });
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCsvContent((event.target?.result as string) || "");
      };
      reader.readAsText(file);
    }
  };

  const insertSampleTemplate = () => {
    setCsvContent(
      `Question,Option A,Option B,Option C,Option D,Correct\n` +
      `"What is Newton's first law of motion?","Law of inertia","Law of acceleration","Law of action-reaction","Law of gravitation",A\n` +
      `"Which particle has no electric charge?","Proton","Electron","Neutron","Positron",C`
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            Quick Upload Questions (CSV)
          </DialogTitle>
          <DialogDescription>
            Bulk upload questions to practice topics with automatic formatting.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Class Level</Label>
              <select
                value={classLevel}
                onChange={(e) => setClassLevel(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm mt-1"
              >
                <option value="Class 11">Class 11</option>
                <option value="Class 12">Class 12</option>
                <option value="Dropper">Dropper</option>
              </select>
            </div>
            <div>
              <Label>Subject</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Physics / Chemistry / Math"
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Topic Name *</Label>
              <Input
                value={topicName}
                onChange={(e) => setTopicName(e.target.value)}
                placeholder="e.g. Thermodynamics"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Target Difficulty</Label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as any)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm mt-1"
              >
                <option value="easy">Easy (15 pts)</option>
                <option value="medium">Medium (25 pts)</option>
                <option value="hard">Hard (40 pts)</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Select CSV File or Paste Below</Label>
              <button
                type="button"
                onClick={insertSampleTemplate}
                className="text-xs text-primary hover:underline font-medium"
              >
                Insert Sample Template
              </button>
            </div>
            <Input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="cursor-pointer mb-2" />
            <textarea
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              placeholder="Question,OptionA,OptionB,OptionC,OptionD,Correct"
              className="w-full h-32 rounded-md border border-input bg-background p-2.5 font-mono text-xs"
            />
          </div>

          {statusMessage && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                statusMessage.error
                  ? "bg-destructive/10 text-destructive border border-destructive/20"
                  : "bg-success/10 text-success border border-success/20"
              }`}
            >
              {statusMessage.error ? (
                <AlertCircle className="w-4 h-4 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between">
          <Link to="/admin/create-practice" onClick={() => onOpenChange(false)}>
            <Button variant="ghost" size="sm" className="text-xs">
              Go to Full Question Builder
            </Button>
          </Link>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="gradient-primary text-primary-foreground"
              disabled={uploadMutation.isPending}
              onClick={() => uploadMutation.mutate()}
            >
              {uploadMutation.isPending ? "Uploading..." : "Upload Questions"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
