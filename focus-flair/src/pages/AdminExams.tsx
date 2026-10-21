import { useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { Input } from "@/components/ui/input";

type ExamStatus = "draft" | "scheduled" | "live" | "completed" | "archived";

type ExamRow = {
  _id: string;
  title: string;
  examCode?: string;
  examType?: string;
  classLevel?: string;
  status: ExamStatus;
  durationMinutes: number;
  totalQuestions?: number;
  createdBy?: string;
  createdAt?: string;
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case "live":
      return "bg-success/10 text-success";
    case "completed":
      return "bg-muted text-muted-foreground";
    case "scheduled":
      return "bg-primary/10 text-primary";
    case "draft":
      return "bg-warning/10 text-warning";
    default:
      return "bg-muted text-muted-foreground";
  }
};

export default function AdminExams() {
  const user = getStoredUser();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: exams = [], isLoading, error } = useQuery<ExamRow[]>({
    queryKey: ["adminExams"],
    queryFn: () => apiRequest<ExamRow[]>("/exams"),
  });

  const createdByMe = useMemo(
    () => exams.filter((exam) => String(exam.createdBy || "") === String(user?._id || "")),
    [exams, user?._id]
  );

  const filtered = useMemo(() => {
    return createdByMe.filter((exam) => {
      const text = `${exam.title} ${exam.examCode || ""} ${exam.examType || ""} ${exam.classLevel || ""}`.toLowerCase();
      const matchesSearch = text.includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || exam.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [createdByMe, search, statusFilter]);

  const counts = useMemo(() => {
    return {
      all: createdByMe.length,
      draft: createdByMe.filter((e) => e.status === "draft").length,
      scheduled: createdByMe.filter((e) => e.status === "scheduled").length,
      live: createdByMe.filter((e) => e.status === "live").length,
      completed: createdByMe.filter((e) => e.status === "completed").length,
      archived: createdByMe.filter((e) => e.status === "archived").length,
    };
  }, [createdByMe]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-destructive">Failed to load created exams. Please refresh.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl animate-fade-in">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Created Exams</h1>
        <p className="text-muted-foreground mt-1">Dedicated admin tab to track all exams created by you</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          ["All", counts.all],
          ["Draft", counts.draft],
          ["Scheduled", counts.scheduled],
          ["Live", counts.live],
          ["Completed", counts.completed],
          ["Archived", counts.archived],
        ].map(([label, value]) => (
          <div key={String(label)} className="stat-card">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      <div className="glass-card rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            placeholder="Search by title, code, type or class..."
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="live">Live</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      <div className="glass-card rounded-xl p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="pb-3 font-medium">Title</th>
                <th className="pb-3 font-medium">Code</th>
                <th className="pb-3 font-medium">Class</th>
                <th className="pb-3 font-medium">Type</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Questions</th>
                <th className="pb-3 font-medium">Duration</th>
                <th className="pb-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((exam) => (
                <tr key={exam._id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-3 font-medium">{exam.title}</td>
                  <td className="py-3 text-muted-foreground">{exam.examCode || "-"}</td>
                  <td className="py-3 text-muted-foreground">{exam.classLevel || "-"}</td>
                  <td className="py-3 text-muted-foreground">{exam.examType || "Standard"}</td>
                  <td className="py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(exam.status)}`}>
                      {exam.status?.charAt(0).toUpperCase() + exam.status?.slice(1)}
                    </span>
                  </td>
                  <td className="py-3">{exam.totalQuestions ?? 0}</td>
                  <td className="py-3">{exam.durationMinutes} min</td>
                  <td className="py-3 text-muted-foreground">
                    {exam.createdAt ? new Date(exam.createdAt).toLocaleDateString() : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!filtered.length ? (
            <p className="text-sm text-muted-foreground py-6">No created exams found for selected filter.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
