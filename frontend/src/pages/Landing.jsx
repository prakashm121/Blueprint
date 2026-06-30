import { Link } from 'react-router-dom';
import { Sparkles, ClipboardList, MessageSquare, ShieldCheck, Bell, Briefcase } from 'lucide-react';

export default function Landing() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <section className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-sm text-sky-200">
              <Sparkles className="h-4 w-4" />
              Built for intelligent career planning and interview readiness
            </div>
            <div>
              <h1 className="text-5xl font-semibold tracking-tight text-white sm:text-6xl">
                PlacementOS makes your engineering career journey clear.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
                Plan your week, track applications, get AI-backed mentor guidance, and keep your preparation moving forward with a polished, modern dashboard.
              </p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row">
              <Link
                to="/register"
                className="inline-flex items-center justify-center rounded-full bg-sky-500 px-6 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-sky-500/20 transition hover:bg-sky-400"
              >
                Get started
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900/80 px-6 py-3 text-base font-semibold text-slate-100 transition hover:border-slate-500"
              >
                Login
              </Link>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: <ClipboardList className="h-6 w-6" />, title: 'Planner', description: 'Keep your weekly goals visible and actionable.' },
              { icon: <MessageSquare className="h-6 w-6" />, title: 'AI Mentor', description: 'Get context-aware support for interviews and resume updates.' },
              { icon: <ShieldCheck className="h-6 w-6" />, title: 'Ready for applications', description: 'Track your readiness score across skills and companies.' },
              { icon: <Bell className="h-6 w-6" />, title: 'Notifications', description: 'Never miss a follow-up or interview reminder.' },
              { icon: <Briefcase className="h-6 w-6" />, title: 'Subject tracker', description: 'Manage learning topics and DSA progress in one place.' },
            ].map((item) => (
              <div key={item.title} className="rounded-3xl border border-slate-800/90 bg-slate-900/70 p-6 shadow-lg shadow-slate-950/20 backdrop-blur">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-300">
                  {item.icon}
                </div>
                <h2 className="mt-5 text-xl font-semibold text-white">{item.title}</h2>
                <p className="mt-3 text-slate-400">{item.description}</p>
              </div>
            ))}
          </section>
        </div>
      </div>
    </main>
  );
}
