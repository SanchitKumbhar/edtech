import { useMemo } from "react";
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
import { TrendingUp, TrendingDown, AlertTriangle, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

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

export default function PerformanceAnalytics() {
  const { data: practiceData, isLoading: statsLoading } = useQuery<PracticeStatsResponse>({
    queryKey: ["practiceStats"],
    queryFn: () => apiRequest<PracticeStatsResponse>("/practice/stats/me"),
  });

  const stats = practiceData?.topicStats || [];
  const analysis = practiceData?.analysis;

  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery<Assignment[]>({
    queryKey: ["assignedExams"],
    queryFn: () => apiRequest<Assignment[]>("/exams/assigned/me"),
  });

  const loading = statsLoading || assignmentsLoading;

  const topicAccuracy = useMemo(
    () => stats.map((s) => ({ topic: s.topicId?.topicName || "Unknown", accuracy: Math.round(s.accuracyPct || 0) })),
    [stats]
  );

  const masteryTrend = useMemo(
    () => stats.map((s, index) => ({ exam: `T${index + 1}`, score: Math.round(s.masteryPct || 0) })),
    [stats]
  );

  const weakTopics = [...stats]
    .sort((a, b) => (a.accuracyPct || 0) - (b.accuracyPct || 0))
    .slice(0, 3)
    .map((s) => s.topicId?.topicName || "Unknown");

  const avgAccuracy = stats.length
    ? Math.round(stats.reduce((sum, s) => sum + (s.accuracyPct || 0), 0) / stats.length)
    : 0;

  const totalAttempted = stats.reduce((sum, s) => sum + (s.totalAttempted || 0), 0);
  const bestMastery = stats.length ? Math.max(...stats.map((s) => Math.round(s.masteryPct || 0))) : 0;
  const avgCorrectStreak = Number(analysis?.avgCorrectStreak || 0).toFixed(2);
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
        <p className="text-muted-foreground mt-1">Live stats from your attempts and assigned exams</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Avg Accuracy", value: `${avgAccuracy}%`, trend: "Topic average", up: avgAccuracy >= 70 },
          { label: "Best Mastery", value: `${bestMastery}%`, trend: "Best topic", up: true },
          { label: "Questions Attempted", value: totalAttempted, trend: "From practice", up: true },
          { label: "Avg Correct Streak", value: avgCorrectStreak, trend: "Per attempt", up: Number(avgCorrectStreak) >= 1 },
          { label: "Weak Topics", value: weakTopics.length, trend: "Need attention", up: false },
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

      <div className="glass-card rounded-xl p-5">
        <h2 className="font-semibold mb-3">Streak Insights</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-lg border border-border/60 bg-muted/40 p-4">
            <p className="text-xs text-muted-foreground mb-1">Current Correct Streak</p>
            <p className="text-2xl font-bold">{currentCorrectStreak}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/40 p-4">
            <p className="text-xs text-muted-foreground mb-1">Best Correct Streak</p>
            <p className="text-2xl font-bold">{bestCorrectStreak}</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-xl p-5">
          <h2 className="font-semibold mb-4">Mastery Trend</h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={masteryTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="exam" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 5, fill: "hsl(var(--primary))" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card rounded-xl p-5">
          <h2 className="font-semibold mb-4">Topic-wise Accuracy</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={topicAccuracy}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="topic" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Bar dataKey="accuracy" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-card rounded-xl p-5 border-warning/30 bg-warning/5">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-warning" />
          <h2 className="font-semibold">Weak Topics</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {weakTopics.length ? (
            weakTopics.map((topic) => (
              <span key={topic} className="px-3 py-1.5 bg-warning/10 text-warning rounded-full text-sm font-medium">
                {topic}
              </span>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No weak topics detected yet.</p>
          )}
        </div>
      </div>

      <div className="glass-card rounded-xl p-5">
        <h2 className="font-semibold mb-4">Assigned Exam History</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="pb-3 font-medium">Exam</th>
                <th className="pb-3 font-medium">Assigned</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Max Marks</th>
              </tr>
            </thead>
            <tbody>
              {assignments.slice(0, 10).map((row) => (
                <tr key={row._id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-3 font-medium">{row.examId?.title || "Exam"}</td>
                  <td className="py-3 text-muted-foreground">
                    {row.examId?.createdAt ? new Date(row.examId.createdAt).toLocaleDateString() : "N/A"}
                  </td>
                  <td className="py-3 capitalize">{row.status || "assigned"}</td>
                  <td className="py-3">{row.examId?.maxMarks ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
