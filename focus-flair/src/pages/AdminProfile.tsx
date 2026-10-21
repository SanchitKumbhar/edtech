import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Edit, Loader2 } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

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

export default function AdminProfile() {
  const { data, isLoading, refetch } = useQuery<ProfilePayload>({
    queryKey: ["adminProfile"],
    queryFn: () => apiRequest<ProfilePayload>("/profile/me"),
  });

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [instituteName, setInstituteName] = useState("");
  const [designation, setDesignation] = useState("");
  const [statusText, setStatusText] = useState("");

  const updateMutation = useMutation({
    mutationFn: () =>
      apiRequest("/profile/me", {
        method: "PUT",
        body: {
          fullName,
          phone,
          instituteName,
          designation,
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

  const user = data?.user;
  const profile = data?.profile;
  const initials = user?.fullName
    ? user.fullName
        .split(" ")
        .map((p) => p[0])
        .join("")
        .toUpperCase()
    : "AD";

  const hydratedName = fullName || user?.fullName || "";
  const hydratedPhone = phone || profile?.phone || "";
  const hydratedInstitute = instituteName || profile?.instituteName || "";
  const hydratedDesignation = designation || profile?.designation || "";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl animate-fade-in">
      <h1 className="text-2xl md:text-3xl font-bold">Admin Profile</h1>

      <div className="glass-card rounded-xl p-6 flex items-center gap-6">
        <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center text-primary-foreground text-xl font-bold shrink-0">
          {initials}
        </div>
        <div>
          <h2 className="text-xl font-bold">{user?.fullName || "Admin"}</h2>
          <p className="text-sm text-muted-foreground">{user?.email || "N/A"}</p>
        </div>
      </div>

      <div className="glass-card rounded-xl p-6 space-y-5">
        <h2 className="font-semibold text-lg flex items-center gap-2">
          <Edit className="w-4 h-4" /> Update Details
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
    </div>
  );
}
