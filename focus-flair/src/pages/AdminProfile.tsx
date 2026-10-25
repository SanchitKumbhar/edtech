import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Edit, Loader2, Users, UserPlus, ShieldCheck, AlertCircle, CheckCircle2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

type ProfilePayload = {
  user: {
    _id: string;
    fullName: string;
    email: string;
    role: "admin" | "student";
  };
  profile?: {
    avatarUrl?: string;
    phone?: string;
    instituteName?: string;
    designation?: string;
  };
};

type InstituteAdmin = {
  _id: string;
  fullName: string;
  email: string;
  role: string;
  createdAt?: string;
};

type InstituteAdminsResponse = {
  institute?: {
    _id: string;
    name: string;
    code: string;
  };
  count: number;
  maxAllowed: number;
  admins: InstituteAdmin[];
};

export default function AdminProfile() {
  const queryClient = useQueryClient();
  const { data, isLoading, refetch } = useQuery<ProfilePayload>({
    queryKey: ["adminProfile"],
    queryFn: () => apiRequest<ProfilePayload>("/profile/me"),
  });

  const {
    data: instituteAdminsData,
    isLoading: adminsLoading,
    refetch: refetchAdmins,
  } = useQuery<InstituteAdminsResponse>({
    queryKey: ["instituteAdmins"],
    queryFn: () => apiRequest<InstituteAdminsResponse>("/institutes/admins"),
  });

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [instituteName, setInstituteName] = useState("");
  const [designation, setDesignation] = useState("");
  const [statusText, setStatusText] = useState("");

  // Add Admin modal state
  const [addAdminOpen, setAddAdminOpen] = useState(false);
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [newAdminConfirmPassword, setNewAdminConfirmPassword] = useState("");
  const [adminCreateError, setAdminCreateError] = useState("");
  const [adminCreateSuccess, setAdminCreateSuccess] = useState("");

  const user = data?.user;
  const profile = data?.profile;

  const updateMutation = useMutation({
    mutationFn: () =>
      apiRequest("/profile/me", {
        method: "PUT",
        body: {
          fullName: fullName !== "" ? fullName : (user?.fullName || ""),
          phone: phone !== "" ? phone : (profile?.phone || ""),
          instituteName: instituteName !== "" ? instituteName : (profile?.instituteName || ""),
          designation: designation !== "" ? designation : (profile?.designation || ""),
        },
      }),
    onSuccess: async () => {
      setStatusText("Profile updated successfully.");
      await refetch();
    },
    onError: (error: Error) => {
      setStatusText(error.message);
    },
  });

  const createAdminMutation = useMutation({
    mutationFn: () => {
      if (newAdminPassword !== newAdminConfirmPassword) {
        throw new Error("Passwords do not match");
      }
      if (newAdminPassword.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }
      return apiRequest("/institutes/admins", {
        method: "POST",
        body: {
          fullName: newAdminName,
          email: newAdminEmail,
          password: newAdminPassword,
        },
      });
    },
    onSuccess: async () => {
      setAdminCreateSuccess("Administrator created successfully!");
      setAdminCreateError("");
      setNewAdminName("");
      setNewAdminEmail("");
      setNewAdminPassword("");
      setNewAdminConfirmPassword("");
      await refetchAdmins();
      setTimeout(() => {
        setAddAdminOpen(false);
        setAdminCreateSuccess("");
      }, 1200);
    },
    onError: (error: any) => {
      setAdminCreateError(error.message || "Failed to create administrator");
    },
  });

  const initials = user?.fullName
    ? user.fullName
        .split(" ")
        .map((p) => p[0])
        .join("")
        .toUpperCase()
    : "AD";

  const hydratedName = fullName !== "" ? fullName : (user?.fullName || "");
  const hydratedPhone = phone !== "" ? phone : (profile?.phone || "");
  const hydratedInstitute = instituteName !== "" ? instituteName : (profile?.instituteName || "");
  const hydratedDesignation = designation !== "" ? designation : (profile?.designation || "");

  const currentAdminCount = instituteAdminsData?.count ?? 1;
  const maxAdminsAllowed = instituteAdminsData?.maxAllowed ?? 5;
  const isMaxAdminsReached = currentAdminCount >= maxAdminsAllowed;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl animate-fade-in">
      <h1 className="text-2xl md:text-3xl font-bold">Admin Profile & Settings</h1>

      <div className="glass-card rounded-xl p-6 flex items-center gap-6">
        <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center text-primary-foreground text-xl font-bold shrink-0">
          {initials}
        </div>
        <div>
          <h2 className="text-xl font-bold">{user?.fullName || "Admin"}</h2>
          <p className="text-sm text-muted-foreground">{user?.email || "N/A"}</p>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
              <ShieldCheck className="w-3 h-3 mr-1" /> Institute Administrator
            </Badge>
            {instituteAdminsData?.institute?.name && (
              <Badge variant="secondary" className="text-xs">
                {instituteAdminsData.institute.name}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="glass-card rounded-xl p-6 space-y-5">
        <h2 className="font-semibold text-lg flex items-center gap-2">
          <Edit className="w-4 h-4 text-primary" /> Update Details
        </h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input value={hydratedName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email || ""} disabled />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={hydratedPhone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Designation</Label>
            <Input value={hydratedDesignation} onChange={(e) => setDesignation(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Institute Name</Label>
          <Input value={hydratedInstitute} onChange={(e) => setInstituteName(e.target.value)} />
        </div>

        <Button
          className="gradient-primary text-primary-foreground"
          onClick={() => {
            setStatusText("");
            updateMutation.mutate();
          }}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>

        {statusText ? <p className="text-sm text-primary">{statusText}</p> : null}
      </div>

      {/* Institute Administrators Management (Max 5 Admins) */}
      <div className="glass-card rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" /> Institute Administrators
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage administrators for this institute. A maximum of 5 admins can be registered.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Badge
              variant={isMaxAdminsReached ? "destructive" : "outline"}
              className={`text-xs px-2.5 py-1 font-semibold ${
                !isMaxAdminsReached ? "bg-primary/10 text-primary border-primary/30" : ""
              }`}
            >
              {currentAdminCount} / {maxAdminsAllowed} Admins
            </Badge>

            <Button
              size="sm"
              className="gradient-primary text-primary-foreground text-xs"
              onClick={() => {
                setAdminCreateError("");
                setAdminCreateSuccess("");
                setAddAdminOpen(true);
              }}
              disabled={isMaxAdminsReached}
              title={isMaxAdminsReached ? "Maximum limit of 5 admins reached" : "Add new administrator"}
            >
              <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Add Admin
            </Button>
          </div>
        </div>

        {isMaxAdminsReached && (
          <div className="flex items-center gap-2 p-3 text-xs rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              Limit reached: Total 5 administrators have been created for this institute. No further admins can be added.
            </span>
          </div>
        )}

        {adminsLoading ? (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" /> Loading administrators...
          </div>
        ) : (
          <div className="divide-y divide-border/60 rounded-lg border border-border/70 overflow-hidden bg-background/50">
            {(instituteAdminsData?.admins || [
              {
                _id: user?._id || "1",
                fullName: user?.fullName || "Admin",
                email: user?.email || "",
                role: "admin",
              },
            ]).map((admin) => (
              <div key={admin._id} className="flex items-center justify-between p-3.5 text-sm hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                    {admin.fullName
                      .split(" ")
                      .map((p) => p[0])
                      .join("")
                      .toUpperCase() || "A"}
                  </div>
                  <div>
                    <div className="font-semibold text-foreground flex items-center gap-2">
                      {admin.fullName}
                      {admin._id === user?._id && (
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.2 rounded font-medium">
                          You
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{admin.email}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[11px] uppercase font-semibold">
                    {admin.role}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Admin Dialog */}
      <Dialog open={addAdminOpen} onOpenChange={setAddAdminOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" /> Add Institute Administrator
            </DialogTitle>
            <DialogDescription>
              Create a new administrator account for your institute ({currentAdminCount}/{maxAdminsAllowed} slots used).
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setAdminCreateError("");
              setAdminCreateSuccess("");
              createAdminMutation.mutate();
            }}
            className="space-y-4 text-sm"
          >
            <div className="space-y-1.5">
              <Label htmlFor="new-admin-name">Full Name *</Label>
              <Input
                id="new-admin-name"
                value={newAdminName}
                onChange={(e) => setNewAdminName(e.target.value)}
                placeholder="e.g. Dr. Rajesh Sharma"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-admin-email">Email Address *</Label>
              <Input
                id="new-admin-email"
                type="email"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                placeholder="admin@institute.edu"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-admin-password">Password (min 6 characters) *</Label>
              <Input
                id="new-admin-password"
                type="password"
                value={newAdminPassword}
                onChange={(e) => setNewAdminPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-admin-confirm-password">Confirm Password *</Label>
              <Input
                id="new-admin-confirm-password"
                type="password"
                value={newAdminConfirmPassword}
                onChange={(e) => setNewAdminConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {adminCreateError && (
              <div className="flex items-center gap-2 p-2.5 rounded text-xs bg-destructive/10 text-destructive border border-destructive/20 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" /> {adminCreateError}
              </div>
            )}

            {adminCreateSuccess && (
              <div className="flex items-center gap-2 p-2.5 rounded text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" /> {adminCreateSuccess}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAddAdminOpen(false);
                  setAdminCreateError("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createAdminMutation.isPending || isMaxAdminsReached}
                className="gradient-primary text-primary-foreground"
              >
                {createAdminMutation.isPending ? "Creating..." : "Create Admin"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
