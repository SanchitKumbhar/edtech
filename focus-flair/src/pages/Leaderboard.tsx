import { useState } from "react";
import { Trophy, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";

type LeaderboardEntry = {
  _id?: string;
  rankNo: number;
  studentId?: string;
  name: string;
  points: number;
  avatar?: string;
};

type LeaderboardResponse = {
  boardType: string;
  rows: LeaderboardEntry[];
};

type Tab = "weekly" | "monthly" | "allTime";

export default function Leaderboard() {
  const user = getStoredUser();
  const [tab, setTab] = useState<Tab>("weekly");

  const { data: leaderboardData, isLoading, error } = useQuery<LeaderboardResponse>({
    queryKey: ["leaderboard", tab],
    queryFn: () =>
      apiRequest<LeaderboardResponse>(`/leaderboard?boardType=${tab}`),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !leaderboardData?.rows) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-destructive">Failed to load leaderboard. Please refresh.</p>
      </div>
    );
  }

  const data = leaderboardData.rows;

  const getMedalColor = (rank: number) => {
    if (rank === 1) return "gradient-accent";
    if (rank === 2) return "bg-muted-foreground/60";
    if (rank === 3) return "bg-streak/70";
    return "bg-muted";
  };

  const topThree = data.length >= 3 ? [data[1], data[0], data[2]] : data.slice(0, 3);

  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-fade-in">
      <div className="text-center">
        <h1 className="text-2xl md:text-3xl font-bold">🏆 Leaderboard</h1>
        <p className="text-muted-foreground mt-1">See where you stand among the best</p>
      </div>

      {/* Tabs */}
      <div className="flex justify-center gap-1 bg-muted rounded-xl p-1">
        {([["weekly", "Weekly"], ["monthly", "Monthly"], ["allTime", "All Time"]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Top 3 podium */}
      {data.length >= 3 && (
        <div className="flex justify-center items-end gap-4 pt-4">
          {topThree.map((entry, i) => {
            const heights = ["h-24", "h-32", "h-20"];
            return (
              <div key={entry.rankNo} className="flex flex-col items-center gap-2">
                <div className={`${i === 1 ? "w-16 h-16" : "w-12 h-12"} rounded-full ${getMedalColor(entry.rankNo)} flex items-center justify-center text-primary-foreground font-bold ${i === 1 ? "text-lg" : "text-sm"}`}>
                  {entry.avatar || entry.name.substring(0, 2).toUpperCase()}
                </div>
                <p className="text-sm font-semibold text-center">{entry.name.split(" ")[0]}</p>
                <p className="text-xs text-muted-foreground">{entry.points.toLocaleString()} pts</p>
                <div className={`${heights[i]} w-20 rounded-t-xl ${getMedalColor(entry.rankNo)} flex items-center justify-center text-primary-foreground font-bold text-xl`}>
                  #{entry.rankNo}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full List */}
      <div className="glass-card rounded-xl divide-y divide-border/50">
        {data.map((entry) => {
          const isCurrentUser = entry.studentId === user?._id;
          return (
            <div
              key={entry.rankNo}
              className={`flex items-center justify-between p-4 ${isCurrentUser ? "bg-primary/5" : ""}`}
            >
              <div className="flex items-center gap-3">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  entry.rankNo <= 3 ? `${getMedalColor(entry.rankNo)} text-primary-foreground` : "bg-muted text-muted-foreground"
                }`}>
                  {entry.rankNo}
                </span>
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                  {entry.avatar || entry.name.substring(0, 2).toUpperCase()}
                </div>
                <span className={`text-sm font-medium ${isCurrentUser ? "text-primary" : ""}`}>
                  {entry.name}
                  {isCurrentUser ? " (You)" : ""}
                </span>
              </div>
              <span className="text-sm font-semibold">{entry.points.toLocaleString()} pts</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
