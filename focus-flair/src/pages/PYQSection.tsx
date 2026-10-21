import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

type PyqSet = {
  _id: string;
  title?: string;
  examName?: string;
  examYear?: number;
  subject?: string;
  isPublished?: boolean;
};

export default function PYQSection() {
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [examFilter, setExamFilter] = useState<string>("all");

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl animate-fade-in">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Previous Year Questions</h1>
        <p className="text-muted-foreground mt-1">Live PYQ sets from your database</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm min-w-[120px]"
        >
          <option value="all">All Years</option>
          {years.map((year) => (
            <option key={year} value={String(year)}>{year}</option>
          ))}
        </select>

        <select
          value={examFilter}
          onChange={(e) => setExamFilter(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm min-w-[180px]"
        >
          <option value="all">All Exams</option>
          {examNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length ? (
          filtered.map((set) => (
            <div key={set._id} className="stat-card">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded">
                  {set.examName || "Exam"}
                </span>
                <span className="text-xs text-muted-foreground">{set.examYear || "N/A"}</span>
              </div>
              <p className="font-semibold">{set.title || "Untitled Set"}</p>
              <p className="text-xs text-muted-foreground mt-1">{set.subject || "General"}</p>
              <p className="text-xs mt-2 text-primary">{set.isPublished ? "Published" : "Draft"}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No PYQ sets found for selected filters.</p>
        )}
      </div>
    </div>
  );
}
