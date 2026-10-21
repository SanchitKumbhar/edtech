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
    <div className="space-y-6 max-w-4xl animate-fade-in">
      <h1 className="text-2xl md:text-3xl font-bold">My Profile 👤</h1>

      {/* Profile Card */}
      <div className="glass-card rounded-xl p-6 flex flex-col sm:flex-row items-center sm:items-start gap-6">
        <div className="w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center text-primary-foreground text-2xl font-bold shrink-0">
          {userInitials}
        </div>
        <div className="flex-1 text-center sm:text-left">
          <h2 className="text-xl font-bold">{profileUser?.fullName || "Student"}</h2>
          <p className="text-sm text-muted-foreground flex items-center justify-center sm:justify-start gap-1 mt-1">
            <Mail className="w-3 h-3" /> {profileUser?.email || "N/A"}
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">{profileUser?.role === "student" ? "Active Student" : "Admin"}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => {
              setEditName(profileUser.fullName || "");
              setEditAvatar(profile?.avatarUrl || "");
              setEditOpen(true);
            }}
          >
            <Edit className="w-3 h-3 mr-1" /> Edit Profile
          </Button>
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
          { label: "Points", value: profile?.pointsTotal || 0, icon: Trophy, color: "gradient-accent" },
          { label: "Badges", value: profile?.badgesCount || 0, icon: Target, color: "gradient-primary" },
          { label: "Streak Days", value: profile?.currentStreakDays || 0, icon: FileText, color: "gradient-success" },
          { label: "Level", value: Math.floor((profile?.pointsTotal || 0) / 500) + 1, icon: BookOpen, color: "bg-info" },
        ].map((s) => (
          <div key={s.label} className="stat-card flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center shrink-0`}>
              <s.icon className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <p className="text-xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
