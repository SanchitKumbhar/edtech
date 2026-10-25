import { Mail, BookOpen, Trophy, Target, FileText, Edit, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { apiRequest } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";

type ProfileData = {
  user: any;
  profile?: any;
};

import React, { useState } from "react";

export default function StudentProfile() {
  // All hooks must be called unconditionally at the top
  const storedUser = getStoredUser();
  const { data: profileData, isLoading, error } = useQuery<ProfileData>({
    queryKey: ["myProfile"],
    queryFn: () => apiRequest<ProfileData>("/profile/me"),
  });
  // Edit Profile modal state (initialize with empty, set values when opening modal)
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (data: { fullName: string; avatarUrl: string }) =>
      apiRequest("/profile/me", { method: "PUT", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries(["myProfile"]);
      setEditOpen(false);
    },
    onSettled: () => setEditLoading(false),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-destructive">Failed to load profile. Please refresh.</p>
      </div>
    );
  }

  const profileUser = profileData.user || storedUser || {};
  const { profile } = profileData;
  const userInitials = (profileUser?.fullName || "")
    .split(" ")
    .filter(Boolean)
    .map((n: string) => n[0])
    .join("")
    .toUpperCase() || "??";

  return (
    <div className="space-y-8 max-w-5xl animate-fade-in pb-10">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">My Profile 👤</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your student credentials and view your learning achievements</p>
      </div>

      {/* Profile Card */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center sm:items-start gap-6 border border-white/50 dark:border-white/10 shadow-xl">
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl gradient-primary flex items-center justify-center text-primary-foreground text-2xl sm:text-3xl font-extrabold shrink-0 shadow-lg shadow-primary/30 border border-white/30">
          {userInitials}
        </div>
        <div className="flex-1 text-center sm:text-left">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{profileUser?.fullName || "Student"}</h2>
              <p className="text-sm text-muted-foreground flex items-center justify-center sm:justify-start gap-1.5 mt-1">
                <Mail className="w-3.5 h-3.5" /> {profileUser?.email || "N/A"}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="glass-card rounded-xl border-border/80 font-medium self-center sm:self-start"
              onClick={() => {
                setEditName(profileUser.fullName || "");
                setEditAvatar(profile?.avatarUrl || "");
                setEditOpen(true);
              }}
            >
              <Edit className="w-3.5 h-3.5 mr-1.5 text-primary" /> Edit Profile
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
              {profileUser?.role === "student" ? "Active Student" : "Admin"}
            </span>
            {profileUser?.instituteId && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border">
                Institute Affiliated
              </span>
            )}
          </div>
              {/* Edit Profile Modal */}
              <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Profile</DialogTitle>
                  </DialogHeader>
                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      setEditLoading(true);
                      mutation.mutate({ fullName: editName, avatarUrl: editAvatar });
                    }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-sm font-medium mb-1">Full Name</label>
                      <Input value={editName} onChange={e => setEditName(e.target.value)} required disabled={editLoading} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Avatar URL</label>
                      <Input value={editAvatar} onChange={e => setEditAvatar(e.target.value)} disabled={editLoading} />
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={editLoading}>Cancel</Button>
                      <Button type="submit" disabled={editLoading}>{editLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Points Earned", value: profile?.pointsTotal || 0, icon: Trophy, color: "gradient-accent" },
          { label: "Badges Earned", value: profile?.badgesCount || 0, icon: Target, color: "gradient-primary" },
          { label: "Day Streak", value: profile?.currentStreakDays || 0, icon: FileText, color: "gradient-success" },
          { label: "Current Level", value: Math.floor((profile?.pointsTotal || 0) / 500) + 1, icon: BookOpen, color: "bg-indigo-600" },
        ].map((s) => (
          <div key={s.label} className="stat-card rounded-2xl p-5 border border-white/40 dark:border-white/10 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl ${s.color} flex items-center justify-center shrink-0 shadow-md`}>
              <s.icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-extrabold tracking-tight">{s.value}</p>
              <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Badges & Achievements Showcase */}
      <StudentBadgesSection studentId={profileUser?._id} />
    </div>
  );
}

function StudentBadgesSection({ studentId }: { studentId?: string }) {
  const { data: badgesData, isLoading } = useQuery<{
    badges: Array<{
      _id: string;
      code: string;
      title: string;
      description: string;
      icon: string;
      pointsReward: number;
      isUnlocked: boolean;
      unlockedAt?: string;
    }>;
    stats: { total: number; unlockedCount: number };
  }>({
    queryKey: ["studentBadges", studentId],
    queryFn: () => apiRequest(`/leaderboard/students/${studentId}`),
    enabled: Boolean(studentId),
  });

  if (isLoading || !badgesData?.badges) {
    return null;
  }

  const { badges, stats } = badgesData;
  const progressPct = stats.total > 0 ? Math.round((stats.unlockedCount / stats.total) * 100) : 0;

  return (
    <div className="glass-panel rounded-3xl p-6 md:p-8 space-y-6 border border-white/50 dark:border-white/10 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            🏆 Badges & Achievements
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Unlocked <span className="font-semibold text-foreground">{stats.unlockedCount}</span> of {stats.total} badges ({progressPct}%)
          </p>
        </div>
        <div className="w-full sm:w-56 space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground font-medium">
            <span>Mastery</span>
            <span>{progressPct}%</span>
          </div>
          <Progress value={progressPct} className="h-2 rounded-full" />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {badges.map((b) => (
          <div
            key={b._id}
            className={`p-4 rounded-2xl border transition-all duration-300 ${
              b.isUnlocked
                ? "glass-card border-primary/40 shadow-md shadow-primary/5 hover:scale-[1.02]"
                : "bg-muted/20 border-dashed border-border/80 opacity-60"
            }`}
          >
            <div className="flex items-start gap-3.5">
              <span className={`text-3xl p-2.5 rounded-2xl shrink-0 shadow-inner ${b.isUnlocked ? "bg-primary/15 border border-primary/20" : "grayscale opacity-40 bg-muted"}`}>
                {b.icon || "🎖️"}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <p className="font-bold text-sm truncate">{b.title}</p>
                  {b.isUnlocked ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 border border-emerald-500/20 px-2 py-0.5 rounded-full shrink-0">
                      Unlocked
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/80 border border-border px-2 py-0.5 rounded-full shrink-0">
                      Locked
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{b.description}</p>
                <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/50 text-[11px]">
                  <span className="text-primary font-bold">+{b.pointsReward} pts</span>
                  {b.unlockedAt ? (
                    <span className="text-muted-foreground">
                      {new Date(b.unlockedAt).toLocaleDateString()}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
