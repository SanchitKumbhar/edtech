import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Loader2,
  FileCheck2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Award,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

type TopicStat = {
  _id: string;
  topicId?: { _id: string; topicName: string };
  masteryPct: number;
  accuracyPct: number;
  solvedCount: number;
  totalAttempted: number;
};

type PracticeAnalysis = {
  currentCorrectStreak: number;
  bestCorrectStreak: number;
  avgCorrectStreak: number;
  totalAttempts: number;
  totalCorrect: number;
  practicePointsTotal: number;
  leaderboardPointsTotal: number;
};

type PracticeStatsResponse = {
  topicStats: TopicStat[];
  analysis: PracticeAnalysis;
};

type ExamSessionHistory = {
  _id: string;
  examId?: {
    _id: string;
    title: string;
    examCode?: string;
    maxMarks?: number;
    totalQuestions?: number;
    durationMinutes?: number;
  };
  scoreObtained: number;
  accuracyPct: number;
  rankInExam?: number;
  percentile?: number;
  status: string;
  submittedAt?: string;
  durationSeconds?: number;
};

type Assignment = {
  _id: string;
  status: string;
  examId?: {
    _id: string;
    title: string;
    maxMarks?: number;
    createdAt?: string;
  };
};

type QuestionReviewItem = {
  _id: string;
  questionNo: number;
  questionText: string;
  subject?: string;
  topic?: string;
  difficulty?: string;
  marks: number;
  negativeMarks: number;
  options: Array<{ _id: string; label: string; text: string; isCorrect: boolean }>;
  selectedOptionId: string | null;
  selectedOptionLabel: string | null;
  correctOptionLabel: string | null;
  isAttempted: boolean;
  isCorrect: boolean;
  marksAwarded: number;
  explanation: string;
};

type ExamReviewResponse = {
  session: ExamSessionHistory;
  questions: QuestionReviewItem[];
};

export default function PerformanceAnalytics() {
  const [selectedReviewSessionId, setSelectedReviewSessionId] = useState<string | null>(null);

  const { data: practiceData, isLoading: statsLoading } = useQuery<PracticeStatsResponse>({
    queryKey: ["practiceStats"],
    queryFn: () => apiRequest<PracticeStatsResponse>("/practice/stats/me"),
  });

  const { data: examHistory = [], isLoading: historyLoading } = useQuery<ExamSessionHistory[]>({
    queryKey: ["myExamSessionsHistory"],
    queryFn: () => apiRequest<ExamSessionHistory[]>("/exams/sessions/my-history"),
  });

  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery<Assignment[]>({
    queryKey: ["assignedExams"],
    queryFn: () => apiRequest<Assignment[]>("/exams/assigned/me"),
  });

  const stats = practiceData?.topicStats || [];
  const analysis = practiceData?.analysis;
  const loading = statsLoading || historyLoading || assignmentsLoading;

  // Real topic accuracy data
  const topicAccuracy = useMemo(
    () =>
      stats.map((s) => ({
        topic: s.topicId?.topicName || "Topic",
        accuracy: Math.round(s.accuracyPct || 0),
      })),
    [stats]
  );

  // Dynamic Exam Performance Timeline or Topic Mastery fallback
  const performanceTrend = useMemo(() => {
    if (examHistory.length > 0) {
      // Sort oldest to newest for chronological trend line
      return [...examHistory]
        .reverse()
        .map((sess, idx) => ({
          label: sess.examId?.title ? sess.examId.title.substring(0, 12) + "..." : `Test #${idx + 1}`,
          score: Math.round(sess.scoreObtained || 0),
          accuracy: Math.round(sess.accuracyPct || 0),
          percentile: Math.round(sess.percentile || 0),
        }));
    }

    // Fallback to topic mastery progression
    return stats.map((s, index) => ({
      label: s.topicId?.topicName ? s.topicId.topicName.substring(0, 10) : `Topic ${index + 1}`,
      score: Math.round(s.masteryPct || 0),
      accuracy: Math.round(s.accuracyPct || 0),
      percentile: 0,
    }));
  }, [examHistory, stats]);

  const weakTopics = useMemo(
    () =>
      [...stats]
        .filter((s) => (s.accuracyPct || 0) < 60)
        .sort((a, b) => (a.accuracyPct || 0) - (b.accuracyPct || 0))
        .slice(0, 4)
        .map((s) => s.topicId?.topicName || "Unknown"),
    [stats]
  );

  const avgAccuracy = useMemo(() => {
    if (examHistory.length > 0) {
      const sum = examHistory.reduce((acc, s) => acc + (s.accuracyPct || 0), 0);
      return Math.round(sum / examHistory.length);
    }
    return stats.length
      ? Math.round(stats.reduce((sum, s) => sum + (s.accuracyPct || 0), 0) / stats.length)
      : 0;
  }, [examHistory, stats]);

  const totalAttempted = stats.reduce((sum, s) => sum + (s.totalAttempted || 0), 0);
  const bestScore = examHistory.length
    ? Math.max(...examHistory.map((s) => s.scoreObtained || 0))
    : stats.length
    ? Math.max(...stats.map((s) => Math.round(s.masteryPct || 0)))
    : 0;

  const avgCorrectStreak = Number(analysis?.avgCorrectStreak || 0).toFixed(1);
  const currentCorrectStreak = analysis?.currentCorrectStreak || 0;
  const bestCorrectStreak = analysis?.bestCorrectStreak || 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl animate-fade-in">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Performance Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Dynamic metrics from your submitted exam sessions and practice drills
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Overall Accuracy", value: `${avgAccuracy}%`, trend: "Exams & Practice", up: avgAccuracy >= 70 },
          { label: "Top Score", value: bestScore, trend: examHistory.length ? "Exam Marks" : "Topic Mastery %", up: true },
          { label: "Exams Submitted", value: examHistory.length, trend: "Completed tests", up: true },
          { label: "Questions Practiced", value: totalAttempted, trend: "From drills", up: true },
          { label: "Avg Correct Streak", value: avgCorrectStreak, trend: "Per drill run", up: Number(avgCorrectStreak) >= 1 },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className={`text-xs mt-1 flex items-center gap-1 ${s.up ? "text-success" : "text-destructive"}`}>
              {s.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {s.trend}
            </p>
          </div>
        ))}
      </div>

      {/* Streak Details */}
      <div className="glass-card rounded-xl p-5">
        <h2 className="font-semibold mb-3">Streak & Drill Insights</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="rounded-lg border border-border/60 bg-muted/40 p-4">
            <p className="text-xs text-muted-foreground mb-1">Current Correct Streak</p>
            <p className="text-2xl font-bold text-primary">{currentCorrectStreak}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/40 p-4">
            <p className="text-xs text-muted-foreground mb-1">Best Correct Streak</p>
            <p className="text-2xl font-bold text-accent-foreground">{bestCorrectStreak}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/40 p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Drill Points</p>
            <p className="text-2xl font-bold">{analysis?.practicePointsTotal || 0}</p>
          </div>
        </div>
      </div>

      {/* Visual Analytics Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">
              {examHistory.length > 0 ? "Exam Score & Accuracy Trend" : "Topic Mastery Progression"}
            </h2>
            <Badge variant="outline" className="text-xs">
              {examHistory.length > 0 ? "Chronological" : "Practice Drills"}
            </Badge>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={performanceTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                }}
              />
              <Line
                type="monotone"
                dataKey="score"
                name={examHistory.length > 0 ? "Score Obtained" : "Mastery %"}
                stroke="hsl(var(--primary))"
                strokeWidth={3}
                dot={{ r: 4, fill: "hsl(var(--primary))" }}
              />
              {examHistory.length > 0 ? (
                <Line
                  type="monotone"
                  dataKey="accuracy"
                  name="Accuracy %"
                  stroke="hsl(var(--accent))"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />
              ) : null}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Topic-wise Accuracy</h2>
            <Badge variant="outline" className="text-xs">
              Active Topics
            </Badge>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topicAccuracy}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="topic" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                }}
              />
              <Bar dataKey="accuracy" name="Accuracy %" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Focus Area / Weak Topics */}
      <div className="glass-card rounded-xl p-5 border-warning/30 bg-warning/5">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-warning" />
          <h2 className="font-semibold">Recommended Focus Topics</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {weakTopics.length ? (
            weakTopics.map((topic) => (
              <span key={topic} className="px-3 py-1.5 bg-warning/10 text-warning rounded-full text-sm font-medium">
                {topic} (Needs Practice)
              </span>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              Great job! All your attempted topics currently maintain high accuracy.
            </p>
          )}
        </div>
      </div>

      {/* Submitted Exam Sessions & Scorecards */}
      <div className="glass-card rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-lg">Exam Scorecards & Attempt History</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Review completed submissions, scores, accuracy, and detailed question breakdown
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="pb-3 font-medium">Exam Title</th>
                <th className="pb-3 font-medium">Submitted</th>
                <th className="pb-3 font-medium">Score</th>
                <th className="pb-3 font-medium">Accuracy</th>
                <th className="pb-3 font-medium">Percentile</th>
                <th className="pb-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {examHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted-foreground">
                    No submitted exams found yet. Start an exam from the Exams tab to see your scorecard here.
                  </td>
                </tr>
              ) : (
                examHistory.map((row) => (
                  <tr key={row._id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-3 font-medium">
                      <div>
                        {row.examId?.title || "Exam"}
                        {row.examId?.examCode ? (
                          <span className="ml-2 text-[11px] text-muted-foreground font-mono">
                            ({row.examId.examCode})
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {row.submittedAt ? new Date(row.submittedAt).toLocaleDateString() : "-"}
                    </td>
                    <td className="py-3 font-semibold">
                      {row.scoreObtained} / {row.examId?.maxMarks ?? "-"}
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                        {row.accuracyPct}%
                      </span>
                    </td>
                    <td className="py-3">
                      {row.percentile !== undefined ? `${row.percentile}th %ile` : "-"}
                    </td>
                    <td className="py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-8"
                        onClick={() => setSelectedReviewSessionId(row._id)}
                      >
                        <FileCheck2 className="w-3.5 h-3.5 mr-1" /> Scorecard
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assigned Tests Awaiting Submission */}
      {assignments.some((a) => a.status !== "submitted") && (
        <div className="glass-card rounded-xl p-5">
          <h2 className="font-semibold mb-3">Pending Assigned Tests</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="pb-2 font-medium">Exam</th>
                  <th className="pb-2 font-medium">Assigned On</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Max Marks</th>
                </tr>
              </thead>
              <tbody>
                {assignments
                  .filter((a) => a.status !== "submitted")
                  .map((row) => (
                    <tr key={row._id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2.5 font-medium">{row.examId?.title || "Exam"}</td>
                      <td className="py-2.5 text-muted-foreground">
                        {row.examId?.createdAt ? new Date(row.examId.createdAt).toLocaleDateString() : "-"}
                      </td>
                      <td className="py-2.5 capitalize text-warning font-medium">{row.status}</td>
                      <td className="py-2.5">{row.examId?.maxMarks ?? "-"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detailed Scorecard & Question Review Dialog */}
      <ExamScorecardReviewModal
        sessionId={selectedReviewSessionId}
        onClose={() => setSelectedReviewSessionId(null)}
      />
    </div>
  );
}

function ExamScorecardReviewModal({
  sessionId,
  onClose,
}: {
  sessionId: string | null;
  onClose: () => void;
}) {
  const [filterType, setFilterType] = useState<"all" | "correct" | "incorrect" | "unattempted">("all");

  const { data, isLoading } = useQuery<ExamReviewResponse>({
    queryKey: ["examSessionReview", sessionId],
    queryFn: () => apiRequest<ExamReviewResponse>(`/exams/sessions/${sessionId}/review`),
    enabled: Boolean(sessionId),
  });

  const session = data?.session;
  const questions = data?.questions || [];

  const correctCount = questions.filter((q) => q.isCorrect).length;
  const incorrectCount = questions.filter((q) => q.isAttempted && !q.isCorrect).length;
  const unattemptedCount = questions.filter((q) => !q.isAttempted).length;

  const filteredQuestions = useMemo(() => {
    if (filterType === "correct") return questions.filter((q) => q.isCorrect);
    if (filterType === "incorrect") return questions.filter((q) => q.isAttempted && !q.isCorrect);
    if (filterType === "unattempted") return questions.filter((q) => !q.isAttempted);
    return questions;
  }, [questions, filterType]);

  return (
    <Dialog open={Boolean(sessionId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Award className="w-5 h-5 text-primary" />
            {session?.examId?.title || "Exam Scorecard & Review"}
          </DialogTitle>
          <DialogDescription>
            Submitted on {session?.submittedAt ? new Date(session.submittedAt).toLocaleString() : "N/A"}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg border bg-card text-center">
                <p className="text-xs text-muted-foreground">Score</p>
                <p className="text-xl font-bold text-primary">
                  {session?.scoreObtained} / {session?.examId?.maxMarks ?? "-"}
                </p>
              </div>
              <div className="p-3 rounded-lg border bg-card text-center">
                <p className="text-xs text-muted-foreground">Accuracy</p>
                <p className="text-xl font-bold">{session?.accuracyPct}%</p>
              </div>
              <div className="p-3 rounded-lg border bg-card text-center">
                <p className="text-xs text-muted-foreground">Rank in Exam</p>
                <p className="text-xl font-bold">#{session?.rankInExam || 1}</p>
              </div>
              <div className="p-3 rounded-lg border bg-card text-center">
                <p className="text-xs text-muted-foreground">Percentile</p>
                <p className="text-xl font-bold">{session?.percentile ?? 100}th</p>
              </div>
            </div>

            {/* Questions breakdown pills */}
            <div className="flex flex-wrap gap-2 items-center justify-between border-b pb-3">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={filterType === "all" ? "default" : "outline"}
                  onClick={() => setFilterType("all")}
                >
                  All ({questions.length})
                </Button>
                <Button
                  size="sm"
                  variant={filterType === "correct" ? "default" : "outline"}
                  className="text-success hover:text-success"
                  onClick={() => setFilterType("correct")}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Correct ({correctCount})
                </Button>
                <Button
                  size="sm"
                  variant={filterType === "incorrect" ? "default" : "outline"}
                  className="text-destructive hover:text-destructive"
                  onClick={() => setFilterType("incorrect")}
                >
                  <XCircle className="w-3.5 h-3.5 mr-1" /> Incorrect ({incorrectCount})
                </Button>
                <Button
                  size="sm"
                  variant={filterType === "unattempted" ? "default" : "outline"}
                  onClick={() => setFilterType("unattempted")}
                >
                  <HelpCircle className="w-3.5 h-3.5 mr-1" /> Skipped ({unattemptedCount})
                </Button>
              </div>
            </div>

            {/* Questions list */}
            <div className="space-y-4">
              {filteredQuestions.map((q) => (
                <div
                  key={q._id}
                  className={`p-4 rounded-xl border space-y-3 ${
                    q.isCorrect
                      ? "border-success/30 bg-success/5"
                      : q.isAttempted
                      ? "border-destructive/30 bg-destructive/5"
                      : "border-border bg-muted/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-sm">
                      <span className="text-muted-foreground mr-1.5">Q{q.questionNo}.</span>
                      {q.questionText}
                    </p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-bold uppercase shrink-0 ${
                        q.isCorrect
                          ? "bg-success/20 text-success"
                          : q.isAttempted
                          ? "bg-destructive/20 text-destructive"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {q.isCorrect ? `+${q.marksAwarded} Marks` : q.isAttempted ? `${q.marksAwarded} Marks` : "Skipped"}
                    </span>
                  </div>

                  {/* Options */}
                  <div className="grid sm:grid-cols-2 gap-2 text-xs">
                    {q.options.map((opt) => {
                      const isSelected = opt._id === q.selectedOptionId;
                      const isOptionCorrect = opt.isCorrect;

                      let style = "border-border/60 bg-card";
                      if (isOptionCorrect) {
                        style = "border-success bg-success/15 font-semibold text-success";
                      } else if (isSelected && !isOptionCorrect) {
                        style = "border-destructive bg-destructive/15 font-semibold text-destructive";
                      }

                      return (
                        <div key={opt._id} className={`p-2.5 rounded-lg border flex items-center gap-2 ${style}`}>
                          <span className="w-5 h-5 rounded-full border flex items-center justify-center shrink-0">
                            {opt.label}
                          </span>
                          <span className="flex-1">{opt.text}</span>
                          {isOptionCorrect ? (
                            <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                          ) : isSelected ? (
                            <XCircle className="w-4 h-4 text-destructive shrink-0" />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation */}
                  {q.explanation ? (
                    <div className="pt-2 border-t border-border/40 text-xs">
                      <p className="font-semibold text-muted-foreground">Explanation:</p>
                      <p className="mt-0.5">{q.explanation}</p>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
