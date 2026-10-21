import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminExamScores() {
  const [selectedExamId, setSelectedExamId] = useState("");

  // Fetch all exams for filter dropdown
  const { data: exams = [], isLoading: examsLoading } = useQuery({
    queryKey: ["allExams"],
    queryFn: () => apiRequest("/exams"),
  });

  // Fetch submitted scores, filtered by exam
  const { data: sessions = [], isLoading: scoresLoading } = useQuery({
    queryKey: ["adminSubmittedScores", selectedExamId],
    queryFn: () => apiRequest(`/exams/admin/submitted-scores${selectedExamId ? `?examId=${selectedExamId}` : ""}`),
  });

  return (
    <div className="space-y-6 max-w-7xl animate-fade-in">
      <h1 className="text-2xl md:text-3xl font-bold">Submitted Exam Scores</h1>
      <div className="glass-card rounded-xl p-4 flex items-center gap-4">
        <span className="font-medium">Filter by Exam:</span>
        <select
          value={selectedExamId}
          onChange={e => setSelectedExamId(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm min-w-[280px]"
        >
          <option value="">All Exams</option>
          {exams.map((exam) => (
            <option key={exam._id} value={exam._id}>{exam.title}</option>
          ))}
        </select>
      </div>
      <div className="glass-card rounded-xl p-4 overflow-x-auto">
        {(examsLoading || scoresLoading) ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="pb-3 font-medium">Exam</th>
                <th className="pb-3 font-medium">Student Name</th>
                <th className="pb-3 font-medium">Email</th>
                <th className="pb-3 font-medium">Score</th>
                <th className="pb-3 font-medium">Accuracy (%)</th>
                <th className="pb-3 font-medium">Submitted At</th>
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No submitted exams found.</td></tr>
              ) : sessions.map((s) => (
                <tr key={s._id} className="border-b border-border/50">
                  <td className="py-3">{s.examId?.title || "-"}</td>
                  <td className="py-3 font-medium">{s.studentId?.fullName || "Student"}</td>
                  <td className="py-3 text-muted-foreground">{s.studentId?.email || "N/A"}</td>
                  <td className="py-3">{s.scoreObtained ?? "-"}</td>
                  <td className="py-3">{s.accuracyPct ?? "-"}</td>
                  <td className="py-3">{s.submittedAt ? new Date(s.submittedAt).toLocaleString() : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
