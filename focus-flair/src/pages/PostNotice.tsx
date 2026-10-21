import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api";

type TargetRole = "student" | "admin" | "all";

type Notice = {
  _id: string;
  title: string;
  body: string;
  targetRole: TargetRole;
  isPinned: boolean;
  publishAt?: string;
  expiresAt?: string;
};

export default function PostNotice() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetRole, setTargetRole] = useState<TargetRole>("all");
  const [isPinned, setIsPinned] = useState(false);
  const [publishAt, setPublishAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [statusText, setStatusText] = useState("");

  const { data: notices = [], isLoading } = useQuery<Notice[]>({
    queryKey: ["notices"],
    queryFn: () => apiRequest<Notice[]>("/notices"),
  });

  const createNoticeMutation = useMutation({
    mutationFn: () =>
      apiRequest<Notice>("/notices", {
        method: "POST",
        body: {
          title,
          body,
          targetRole,
          isPinned,
          publishAt: publishAt || undefined,
          expiresAt: expiresAt || undefined,
        },
      }),
    onSuccess: () => {
      setStatusText("Notice posted successfully.");
      setTitle("");
      setBody("");
      setTargetRole("all");
      setIsPinned(false);
      setPublishAt("");
      setExpiresAt("");
      queryClient.invalidateQueries({ queryKey: ["notices"] });
    },
    onError: (error: Error) => {
      setStatusText(error.message || "Failed to post notice");
    },
  });

  const deleteNoticeMutation = useMutation({
    mutationFn: (noticeId: string) =>
      apiRequest(`/notices/${noticeId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notices"] });
    },
  });

  return (
    <div className="space-y-6 max-w-5xl animate-fade-in">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Post Notice</h1>
        <p className="text-muted-foreground mt-1">Create and manage announcements for students and admins.</p>
      </div>

      <div className="glass-card rounded-xl p-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="notice-title">Title</Label>
          <Input
            id="notice-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Exam schedule update"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notice-body">Message</Label>
          <Textarea
            id="notice-body"
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write notice content"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="target-role">Target</Label>
            <select
              id="target-role"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value as TargetRole)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">All</option>
              <option value="student">Students</option>
              <option value="admin">Admins</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="publish-at">Publish At</Label>
            <Input
              id="publish-at"
              type="datetime-local"
              value={publishAt}
              onChange={(e) => setPublishAt(e.target.value)}
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="expires-at">Expires At (optional)</Label>
            <Input
              id="expires-at"
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>

          <div className="flex items-end gap-2 pb-2">
            <input
              id="is-pinned"
              type="checkbox"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
            />
            <Label htmlFor="is-pinned">Pin this notice</Label>
          </div>
        </div>

        <div className="flex gap-3 items-center">
          <Button
            className="gradient-primary text-primary-foreground"
            disabled={createNoticeMutation.isPending || !title.trim() || !body.trim()}
            onClick={() => {
              setStatusText("");
              createNoticeMutation.mutate();
            }}
          >
            {createNoticeMutation.isPending ? "Posting..." : "Post Notice"}
          </Button>
          {statusText ? <p className="text-sm text-primary">{statusText}</p> : null}
        </div>
      </div>

      <div className="glass-card rounded-xl p-6">
        <h2 className="font-semibold text-lg mb-4">Existing Notices</h2>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading notices...
          </div>
        ) : notices.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notices posted yet.</p>
        ) : (
          <div className="space-y-3">
            {notices.map((notice) => (
              <div key={notice._id} className="rounded-xl border border-border p-4 bg-background/70">
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-semibold">{notice.title}</p>
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{notice.body}</p>
                    <div className="flex flex-wrap gap-2 mt-3 text-xs">
                      <span className="px-2 py-0.5 rounded bg-primary/10 text-primary">{notice.targetRole}</span>
                      {notice.isPinned ? <span className="px-2 py-0.5 rounded bg-warning/10 text-warning">Pinned</span> : null}
                      {notice.publishAt ? (
                        <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground">
                          Publish: {new Date(notice.publishAt).toLocaleString()}
                        </span>
                      ) : null}
                      {notice.expiresAt ? (
                        <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground">
                          Expires: {new Date(notice.expiresAt).toLocaleString()}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={deleteNoticeMutation.isPending}
                    onClick={() => deleteNoticeMutation.mutate(notice._id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
