import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/api";
import { setAuthSession } from "@/lib/auth";

type Role = "student" | "admin";

export default function Login() {
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loginMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ token: string; user: any }>("/auth/login", {
        method: "POST",
        auth: false,
        body: { email, password, role },
      }),
    onSuccess: (data) => {
      setAuthSession(data.token, data.user);
      navigate(data.user.role === "admin" ? "/admin" : "/student/dashboard");
    },
    onError: (e: Error) => {
      setError(e.message || "Login failed");
    },
  });

  const handleLogin = () => {
    setError(null);
    loginMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden px-4 py-10 flex items-center justify-center">
      {/* Ambient background glows for realistic glassy refraction */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary/20 blur-[130px]" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-purple-600/15 blur-[140px]" />
      </div>
      <div className="w-full max-w-md glass-card rounded-2xl p-6 md:p-8 space-y-5 animate-fade-in relative z-10">
        <div>
          <h1 className="text-2xl font-bold">Login</h1>
          <p className="text-sm text-muted-foreground mt-1">Access your exam preparation portal</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>Login As</Label>
          <Select value={role} onValueChange={(v: Role) => setRole(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="student">Student</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button
          className="w-full gradient-primary text-primary-foreground"
          onClick={handleLogin}
          disabled={loginMutation.isPending}
        >
          {loginMutation.isPending ? "Signing In..." : "Sign In"}
        </Button>

        <p className="text-sm text-muted-foreground text-center">
          New here? <Link className="text-primary hover:underline" to="/register">Create account</Link>
        </p>
      </div>
    </div>
  );
}
