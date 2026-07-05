import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, Brain, Shield, Bell, BookOpen, Award } from 'lucide-react';

export default function Landing() {
  const features = [
    {
      icon: Calendar,
      title: "Planner",
      description: "Keep your weekly goals visible and actionable. Sync with calendars and technical prep timelines.",
    },
    {
      icon: Brain,
      title: "AI Mentor",
      description: "Get context-aware support for interviews and resume updates, tailored to your engineering domain.",
    },
    {
      icon: Shield,
      title: "Ready for Applications",
      description: "Track your readiness score across skills and companies. Know exactly when to hit submit.",
    },
    {
      icon: Bell,
      title: "Notifications",
      description: "Never miss a follow-up or interview reminder. Intelligent alerts keep you on track.",
    },
    {
      icon: BookOpen,
      title: "Subject Tracker",
      description: "Manage learning topics and DSA progress in one place. Scale your technical depth.",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col relative overflow-hidden selection:bg-sky-500/30 selection:text-sky-200">
      
      {/* Dynamic Keyframe Animations */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.15; }
          50% { transform: translateY(-15px) scale(1.05); opacity: 0.2; }
        }
        .animate-fade-in-up {
          animation: fadeInUp 2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-delay-100 { animation-delay: 100ms; }
        .animate-delay-200 { animation-delay: 200ms; }
      `}</style>

      {/* Decorative Floating Ambient Lights */}
      <div 
        className="absolute top-1/4 left-1/4 -translate-x-1/2 w-125 h-125 bg-sky-500/10 rounded-full blur-[140px] pointer-events-none"
        style={{ animation: 'float 8s ease-in-out infinite' }}
      ></div>
      <div 
        className="absolute bottom-1/4 right-10 w-100 h-100 bg-indigo-500/10 rounded-full blur-[140px] pointer-events-none"
        style={{ animation: 'float 10s ease-in-out infinite reverse' }}
      ></div>

      {/* Landing Header */}
      <header className="max-w-7xl mx-auto w-full h-20 px-6 md:px-8 flex justify-between items-center relative z-10 opacity-0 animate-fade-in-up">
        <div className="flex items-center gap-2 group cursor-pointer">
          <Award className="w-6 h-6 text-sky-400 transition-transform duration-300 group-hover:rotate-12" />
          <span className="text-xl font-bold tracking-tight bg-linear-to-r from-white to-slate-300 bg-clip-text text-transparent">
            Blueprint
          </span>
        </div>
        <div className="flex items-center gap-6">
          <Link to="/login" className="text-sm font-medium text-slate-300 hover:text-sky-400 transition-colors duration-200">
            Login
          </Link>
          <Link
            to="/register"
            className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs py-2 px-5 rounded-lg transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] shadow-lg shadow-sky-500/10"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 md:px-8 py-8 md:py-16 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center relative z-10">
        
        {/* Left Intro Column */}
        <div className="lg:col-span-6 space-y-8 opacity-0 animate-fade-in-up animate-delay-100">
          <div className="inline-flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-full py-1.5 px-4 text-xs font-medium text-sky-400">
            <Award className="w-3.5 h-3.5 animate-pulse" />
            Built for intelligent career planning and interview readiness
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.15] tracking-tight">
            Build your engineering career with data,{" "}
            <span className="bg-clip-text text-transparent bg-linear-to-r from-sky-400 via-sky-300 to-indigo-400">
              not guesswork.
            </span>
          </h1>

          <p className="text-slate-400 text-base md:text-lg max-w-xl leading-relaxed">
            Plan your week, track applications, get AI-backed mentor guidance, and keep your preparation moving forward
            with a polished, modern dashboard designed for top technical talent.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link
              to="/register"
              className="group bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-sm py-3 px-6 rounded-lg shadow-lg shadow-sky-500/10 flex items-center gap-2 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
            >
              Get Started
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <Link
              to="/login"
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-850 text-slate-200 font-semibold text-sm py-3 px-6 rounded-lg transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] inline-flex items-center justify-center"
            >
              Login
            </Link>
          </div>

          {/* Social Proof */}
          <div className="pt-8 border-t border-slate-900 space-y-3">
            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">
              Trusted by 10,000+ engineers at
            </p>
            {/*<div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-400 font-medium">
              {["Google", "Amazon", "Meta", "Netflix", "Microsoft"].map((company) => (
                <span key={company} className="opacity-50 hover:opacity-100 hover:text-sky-400 transition-all duration-200 cursor-default">
                  {company}
                </span>
              ))}
            </div>*/}
          </div>
        </div>

        {/* Right Feature Showcase Column (No Inner Scrollbar!) */}
        <div className="lg:col-span-6 space-y-3 opacity-0 animate-fade-in-up animate-delay-200">
          <p className="text-[10px] font-bold text-sky-400 uppercase tracking-widest mb-1 pl-1">
            Core Engine Features
          </p>
          
          <div className="space-y-3">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div
                  key={i}
                  className="group bg-slate-900/40 border border-slate-900/80 rounded-xl p-4 hover:border-sky-500/30 hover:bg-slate-900/80 transition-all duration-300 flex items-start gap-4 cursor-default"
                >
                  <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0 text-sky-400 transition-all duration-300 group-hover:bg-sky-500 group-hover:text-slate-950 group-hover:scale-105">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-200 mb-0.5 group-hover:text-sky-400 transition-colors duration-200">
                      {feature.title}
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="h-16 border-t border-slate-900/60 flex items-center justify-center text-[11px] text-slate-500 relative z-10">
        © 2026 Blueprint. All rights reserved.
      </footer>
    </div>
  );
}