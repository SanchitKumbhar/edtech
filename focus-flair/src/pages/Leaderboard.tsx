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

  const getMedalStyle = (rank: number) => {
    if (rank === 1) return {
      badge: "bg-gradient-to-tr from-amber-500 to-yellow-300 text-amber-950 shadow-lg shadow-amber-500/25",
      podium: "bg-gradient-to-t from-amber-500/80 to-yellow-300/90 text-amber-950 shadow-xl shadow-amber-500/20",
      ring: "ring-4 ring-amber-400/40 shadow-xl shadow-amber-500/30",
    };
    if (rank === 2) return {
      badge: "bg-gradient-to-tr from-slate-400 to-slate-200 text-slate-900 shadow-md",
      podium: "bg-gradient-to-t from-slate-400/80 to-slate-200/90 text-slate-900 shadow-lg",
      ring: "ring-2 ring-slate-300/40",
    };
    if (rank === 3) return {
      badge: "bg-gradient-to-tr from-amber-700 to-amber-500 text-amber-100 shadow-md",
      podium: "bg-gradient-to-t from-amber-700/80 to-amber-500/90 text-amber-100 shadow-lg",
      ring: "ring-2 ring-amber-600/40",
    };
    return {
      badge: "bg-muted text-muted-foreground",
      podium: "bg-muted text-muted-foreground",
      ring: "",
    };
  };

  const topThree = data.length >= 3 ? [data[1], data[0], data[2]] : data.slice(0, 3);

  return (
    <div className="space-y-8 max-w-4xl mx-auto animate-fade-in pb-12">
      <div className="text-center space-y-2">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">🏆 Hall of Fame</h1>
        <p className="text-muted-foreground max-w-md mx-auto text-sm">
          Climb the ranks, conquer practice tests, and secure your place at the top
        </p>
      </div>

      {/* Glassy Tabs Switcher */}
      <div className="flex justify-center">
        <div className="inline-flex p-1.5 bg-muted/60 backdrop-blur-md rounded-2xl border border-border/50 gap-1.5 shadow-sm">
          {([["weekly", "Weekly Standings"], ["monthly", "Monthly Rank"], ["allTime", "All-Time Legends"]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                tab === key
                  ? "bg-card text-foreground shadow-md shadow-primary/10 border border-white/40 dark:border-white/10"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Top 3 Podium */}
      {data.length >= 3 && (
        <div className="flex justify-center items-end gap-3 sm:gap-6 pt-6 px-4">
          {topThree.map((entry, i) => {
            const heights = ["h-32 sm:h-36", "h-44 sm:h-48", "h-24 sm:h-28"];
            const medal = getMedalStyle(entry.rankNo);
            const isCenter = i === 1;

            return (
              <div key={entry.rankNo} className={`flex flex-col items-center gap-2.5 transition-all ${isCenter ? "-translate-y-2 z-10" : "z-0"}`}>
                <div className={`relative ${isCenter ? "w-16 h-16 sm:w-20 sm:h-20" : "w-12 h-12 sm:w-14 sm:h-14"} rounded-2xl ${medal.badge} ${medal.ring} flex items-center justify-center font-extrabold ${isCenter ? "text-xl sm:text-2xl" : "text-base"} transition-transform hover:scale-105`}>
                  {entry.avatar || entry.name.substring(0, 2).toUpperCase()}
                  {isCenter && (
                    <span className="absolute -top-3 -right-2 text-xl drop-shadow-md">👑</span>
                  )}
                </div>
                <div className="text-center">
                  <p className="text-sm sm:text-base font-bold truncate max-w-[100px] sm:max-w-[120px]">{entry.name.split(" ")[0]}</p>
                  <p className="text-xs font-semibold text-primary">{entry.points.toLocaleString()} pts</p>
                </div>
                <div className={`${heights[i]} w-24 sm:w-32 rounded-t-3xl ${medal.podium} flex flex-col items-center justify-start pt-4 backdrop-blur-md border-t border-x border-white/50 font-black text-2xl sm:text-3xl`}>
                  #{entry.rankNo}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full List */}
      <div className="glass-panel rounded-3xl overflow-hidden border border-white/50 dark:border-white/10 shadow-xl divide-y divide-border/40">
        {data.map((entry) => {
          const isCurrentUser = entry.studentId === user?._id;
          const medal = getMedalStyle(entry.rankNo);
          return (
            <div
              key={entry.rankNo}
              className={`flex items-center justify-between p-4 sm:p-5 transition-colors ${
                isCurrentUser ? "bg-primary/10 border-l-4 border-l-primary" : "hover:bg-muted/30"
              }`}
            >
              <div className="flex items-center gap-3.5 sm:gap-4">
                <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold ${
                  entry.rankNo <= 3 ? `${medal.badge}` : "bg-muted/70 text-muted-foreground border border-border/50"
                }`}>
                  {entry.rankNo}
                </span>
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                  {entry.avatar || entry.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <span className={`text-sm sm:text-base font-bold ${isCurrentUser ? "text-primary" : "text-foreground"}`}>
                    {entry.name}
                    {isCurrentUser ? " (You)" : ""}
                  </span>
                  <p className="text-xs text-muted-foreground sm:hidden">Rank #{entry.rankNo}</p>
                </div>
              </div>
              <span className="text-sm sm:text-base font-extrabold text-foreground tracking-tight">
                {entry.points.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">pts</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
