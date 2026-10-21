import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Building2, GraduationCap, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/api";
import { setAuthSession } from "@/lib/auth";

type AccountType = "student" | "institute_admin";

export default function Register() {
  const navigate = useNavigate();
  const [accountType, setAccountType] = useState<AccountType>("student");

  // Common fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Student specific: Institute Code
  const [instituteCode, setInstituteCode] = useState("");

  // Institute Admin specific: New Institute Details
  const [instituteName, setInstituteName] = useState("");
  const [customInstituteCode, setCustomInstituteCode] = useState("");

  const [error, setError] = useState<string | null>(null);

  // Mutation for Student registration
  const studentRegisterMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ token: string; user: any }>("/auth/register", {
        method: "POST",
        auth: false,
        body: {
          fullName,
          email,
          password,
          role: "student",
          instituteCode: instituteCode.trim().toUpperCase() || undefined,
        },
      }),
    onSuccess: (data) => {
      setAuthSession(data.token, data.user);
      navigate("/student/dashboard");
    },
    onError: (e: Error) => {
      setError(e.message || "Registration failed");
    },
  });

  // Mutation for New Institute Onboarding
  const instituteRegisterMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ token: string; user: any; institute: any }>("/institutes/register", {
        method: "POST",
        auth: false,
        body: {
          name: instituteName,
          code: customInstituteCode.trim().toUpperCase() || undefined,
          adminName: fullName,
          adminEmail: email,
          adminPassword: password,
        },
      }),
    onSuccess: (data) => {
      setAuthSession(data.token, data.user);
      navigate("/admin");
    },
    onError: (e: Error) => {
      setError(e.message || "Institute registration failed");
    },
  });

  const handleRegister = () => {
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (accountType === "student") {
      studentRegisterMutation.mutate();
    } else {
      if (!instituteName.trim()) {
        setError("Institute Name is required");
        return;
      }
      instituteRegisterMutation.mutate();
    }
  };

  const isPending =
    studentRegisterMutation.isPending || instituteRegisterMutation.isPending;

  return (
    <div className="min-h-screen bg-background px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-xl glass-card rounded-2xl p-6 md:p-8 space-y-6 animate-fade-in border shadow-lg">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Focus Flair Account</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Multi-Institute examination & learning platform
          </p>
        </div>

        {/* Account Type Selector Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl">
          <button
            type="button"
            onClick={() => {
              setAccountType("student");
              setError(null);
            }}
            className={`flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
              accountType === "student"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            Student Account
          </button>
          <button
            type="button"
            onClick={() => {
              setAccountType("institute_admin");
              setError(null);
            }}
            className={`flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
              accountType === "institute_admin"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Building2 className="w-4 h-4" />
            New Institute (Admin)
          </button>
        </div>

        {/* Institute Admin Specific Fields */}
        {accountType === "institute_admin" && (
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-4">
            <div className="flex items-center gap-2 text-primary font-medium text-sm">
              <ShieldCheck className="w-4 h-4" />
              Institute Information
            </div>
            <div className="space-y-2">
              <Label htmlFor="instituteName">Institute / School / College Name *</Label>
              <Input
                id="instituteName"
                placeholder="e.g. Apex Academy"
                value={instituteName}
                onChange={(e) => setInstituteName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customCode">Preferred Institute Code (Optional)</Label>
              <Input
                id="customCode"
                placeholder="e.g. APEX101 (Auto-generated if left blank)"
                value={customInstituteCode}
                onChange={(e) => setCustomInstituteCode(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Students will use this code to join your institute exams.
              </p>
            </div>
          </div>
        )}

        {/* Student Specific Fields */}
        {accountType === "student" && (
          <div className="space-y-2">
            <Label htmlFor="instCode">Institute Code (Optional)</Label>
            <Input
              id="instCode"
              placeholder="e.g. APEX101"
              value={instituteCode}
              onChange={(e) => setInstituteCode(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Enter your school or institute code to access private tests and assignments.
            </p>
          </div>
        )}

        {/* Personal Credentials */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              {accountType === "institute_admin" ? "Admin Full Name *" : "Your Full Name *"}
            </Label>
            <Input
              id="name"
              placeholder="Alex Johnson"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              placeholder="alex@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="password">Password *</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password *</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
        </div>

        {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

        <Button
          className="w-full gradient-primary text-primary-foreground font-semibold py-2.5"
          onClick={handleRegister}
          disabled={isPending}
        >
          {isPending
            ? "Creating Account..."
            : accountType === "institute_admin"
            ? "Register Institute & Admin Account"
            : "Create Student Account"}
        </Button>

        <p className="text-sm text-muted-foreground text-center">
          Already have an account?{" "}
          <Link className="text-primary hover:underline font-medium" to="/login">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
