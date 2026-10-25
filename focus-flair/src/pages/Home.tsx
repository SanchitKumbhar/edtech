import { ArrowRight, ShieldCheck, Trophy, BarChart3, Flame } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden px-4 py-12 md:py-20 flex flex-col justify-center">
      {/* Ambient background glows for realistic glassy refraction */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 left-1/4 w-[500px] h-[500px] rounded-full bg-primary/20 blur-[150px]" />
        <div className="absolute top-1/2 -right-32 w-[450px] h-[450px] rounded-full bg-purple-600/15 blur-[160px]" />
        <div className="absolute -bottom-40 left-10 w-[500px] h-[500px] rounded-full bg-indigo-500/15 blur-[160px]" />
      </div>

      <div className="max-w-6xl mx-auto w-full space-y-10 animate-fade-in relative z-10">
        <header className="rounded-3xl p-8 md:p-14 glass-panel border border-white/50 dark:border-white/10 shadow-2xl overflow-hidden relative">
          <div className="relative z-10 space-y-5">
            <span className="inline-flex items-center gap-2 text-xs font-bold tracking-wide uppercase bg-primary/15 text-primary px-3.5 py-1.5 rounded-full border border-primary/20 backdrop-blur-md shadow-sm">
              <ShieldCheck className="w-3.5 h-3.5" /> Next-Gen Exam & Practice Platform
            </span>
            <h1 className="text-3xl md:text-6xl font-extrabold tracking-tight leading-tight max-w-3xl">
              Precision Preparation. <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-primary via-indigo-500 to-purple-600 bg-clip-text text-transparent">
                Exceptional Results.
              </span>
            </h1>
            <p className="text-muted-foreground max-w-2xl text-base md:text-lg leading-relaxed">
              Focused real-time exam simulations, gamified practice streaks, granular topic analytics, and multi-tenant institute management.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-3">
              <Link to="/login">
                <Button className="gradient-primary text-primary-foreground font-semibold px-6 py-2.5 rounded-xl shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all">
                  Sign In <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </Link>
              <Link to="/register">
                <Button variant="outline" className="rounded-xl px-6 py-2.5 glass-card border-border/80 hover:bg-card font-medium">
                  Create Account
                </Button>
              </Link>
            </div>
          </div>
        </header>

        <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            {
              title: "Real Exam Flow",
              desc: "Full instruction screen, live timers, question palette, and section reviews.",
              icon: ShieldCheck,
              color: "text-blue-500",
            },
            {
              title: "Gamified Practice",
              desc: "Streaks, points, achievement badges, and adaptive difficulty drills.",
              icon: Flame,
              color: "text-amber-500",
            },
            {
              title: "Performance Insights",
              desc: "Trend charts, weak topic breakdowns, subject mastery, and full history.",
              icon: BarChart3,
              color: "text-emerald-500",
            },
            {
              title: "Live Leaderboards",
              desc: "Weekly, monthly, and all-time rankings with instant score highlights.",
              icon: Trophy,
              color: "text-purple-500",
            },
          ].map((item) => (
            <div key={item.title} className="stat-card rounded-2xl p-6 border border-white/40 dark:border-white/10">
              <div className="w-10 h-10 rounded-xl bg-card flex items-center justify-center border border-border/60 shadow-sm mb-4">
                <item.icon className={`w-5 h-5 ${item.color}`} />
              </div>
              <h3 className="font-bold text-base mb-1.5">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </section>

        <section className="grid md:grid-cols-2 gap-6">
          <div className="glass-card rounded-3xl p-8 border border-white/40 dark:border-white/10 shadow-xl flex flex-col justify-between">
            <div>
              <div className="inline-block p-3 rounded-2xl bg-primary/10 border border-primary/20 text-primary mb-4">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold mb-2">Student Portal</h2>
              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                Take scheduled institute exams, solve past year papers (PYQs), track study streaks, and drill custom practice sets.
              </p>
            </div>
            <Link to="/student/dashboard">
              <Button variant="outline" className="w-full glass-card border-border/80 rounded-xl font-semibold">
                Open Student Portal &rarr;
              </Button>
            </Link>
          </div>

          <div className="glass-card rounded-3xl p-8 border border-white/40 dark:border-white/10 shadow-xl flex flex-col justify-between">
            <div>
              <div className="inline-block p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 mb-4">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold mb-2">Admin Portal</h2>
              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                Publish exams, monitor student proctoring logs in real-time, upload PYQ sets with PDFs, and manage institute admins.
              </p>
            </div>
            <Link to="/admin">
              <Button variant="outline" className="w-full glass-card border-border/80 rounded-xl font-semibold">
                Open Admin Portal &rarr;
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
