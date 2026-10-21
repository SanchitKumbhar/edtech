import { ArrowRight, ShieldCheck, Trophy, BarChart3, Flame } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen bg-background px-4 py-10 md:py-16">
      <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
        <header className="rounded-2xl p-8 md:p-12 glass-card border-primary/20 overflow-hidden relative">
          <div className="absolute -top-20 -right-16 w-64 h-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-10 w-72 h-72 rounded-full bg-accent/10 blur-3xl" />
          <div className="relative z-10 space-y-4">
            <span className="inline-flex items-center gap-2 text-xs font-semibold bg-primary/10 text-primary px-3 py-1 rounded-full">
              <ShieldCheck className="w-3 h-3" /> Competitive-Exam Ready Platform
            </span>
            <h1 className="text-3xl md:text-5xl font-extrabold leading-tight max-w-3xl">
              Student Exam Preparation Portal
            </h1>
            <p className="text-muted-foreground max-w-2xl text-sm md:text-base">
              Focused exam simulations, gamified practice, deep analytics, and anti-cheating monitoring for both students and admins.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link to="/login">
                <Button className="gradient-primary text-primary-foreground">
                  Login <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
              <Link to="/register">
                <Button variant="outline">Create Account</Button>
              </Link>
            </div>
          </div>
        </header>

        <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              title: "Real Exam Flow",
              desc: "Instruction screen, timer, question grid, and review states.",
              icon: ShieldCheck,
            },
            {
              title: "Gamified Practice",
              desc: "Streaks, points, badges, and difficulty-wise drills.",
              icon: Flame,
            },
            {
              title: "Performance Insights",
              desc: "Trend charts, weak topics, filters, and exam history.",
              icon: BarChart3,
            },
            {
              title: "Leaderboard",
              desc: "Weekly, monthly, all-time rankings with highlights.",
              icon: Trophy,
            },
          ].map((item) => (
            <div key={item.title} className="stat-card rounded-xl p-5">
              <item.icon className="w-5 h-5 text-primary mb-3" />
              <h3 className="font-semibold mb-1">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </section>

        <section className="grid md:grid-cols-2 gap-4">
          <div className="glass-card rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-2">Student Entry</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Access dashboard, exam simulation, practice mode, PYQ section, analytics, and profile.
            </p>
            <Link to="/student/dashboard">
              <Button variant="outline">Open Student Portal</Button>
            </Link>
          </div>
          <div className="glass-card rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-2">Admin Entry</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Manage tests, monitor sessions test-wise, add exam and practice questions, and manage students.
            </p>
            <Link to="/admin">
              <Button variant="outline">Open Admin Portal</Button>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
