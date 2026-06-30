import { useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { useAuthStore } from '../store/authStore';
import {
  Bell, Briefcase, ClipboardList, MessageSquare,
  ShieldCheck, Sparkles, ChevronRight, TrendingUp,
  BookOpen, Code2, FileText, BarChart3, LogOut
} from 'lucide-react';

const tileData = [
  {
    title: 'Planner',
    text: 'Organize weekly goals and deadlines in one place.',
    icon: ClipboardList,
    link: '/planner',
    color: '#0ea5e9',
  },
  {
    title: 'AI Mentor',
    text: 'Ask questions, get interview prep help, and refine your resume.',
    icon: MessageSquare,
    link: '/mentor',
    color: '#8b5cf6',
  },
  {
    title: 'Knowledge Vault',
    text: 'Save notes, flashcards, and topic references for review.',
    icon: BookOpen,
    link: null,
    color: '#22c55e',
  },
  {
    title: 'Resume Analyzer',
    text: 'Upload and analyze your resume to improve your fit.',
    icon: FileText,
    link: null,
    color: '#f59e0b',
  },
  {
    title: 'Interview Hub',
    text: 'Track interviews, feedback, and next-step follow-ups.',
    icon: Briefcase,
    link: null,
    color: '#ef4444',
  },
  {
    title: 'Progress Score',
    text: 'See your readiness at a glance across key career areas.',
    icon: BarChart3,
    link: null,
    color: '#06b6d4',
  },
];

function StatCard({ label, value, subtitle, icon: Icon, color }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg hover:border-slate-600">
      <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full opacity-[0.07]" style={{ background: color }} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="mt-2 text-4xl font-semibold text-white">{value}</p>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>
        <div
          className="inline-flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ background: `${color}15`, color }}
        >
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboardSummary'],
    queryFn: async () => {
      const response = await api.get('/api/v1/dashboard');
      return response.data;
    },
    retry: false,
  });

  const profile = data?.profile ?? {};
  const stats = {
    overall_readiness: data?.overall_readiness ?? 0,
    weekly_tasks_completed: data?.weekly_tasks_completed ?? 0,
    weekly_tasks_total: data?.weekly_tasks_total ?? 0,
    upcoming_interviews: data?.upcoming_interviews ?? 0,
    planner_completion: data?.planner_completion ?? 0,
    dsa_solved: data?.dsa_solved ?? 0,
    subjects_completed: data?.subjects_completed ?? 0,
    resume_score: data?.resume_score ?? 0,
    applications_sent: data?.applications_sent ?? 0,
  };

  const welcomeName = useMemo(() => {
    if (isLoading) return '…';
    if (isError) return '';
    return profile.full_name ? `, ${profile.full_name}` : '';
  }, [profile.full_name, isError, isLoading]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-6 py-8 lg:px-8">

        {/* Header */}
        <header className="flex flex-col gap-6 rounded-3xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl shadow-slate-950/40 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-sky-400/80">Dashboard</p>
            <h1 className="mt-3 text-4xl font-semibold text-white sm:text-5xl">Welcome back{welcomeName}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Your latest readiness metrics are shown below. Continue with your weekly planner, AI mentor advice, and interview prep.
            </p>
          </div>
          <Link
            to="/notifications"
            className="flex items-center gap-3 self-start rounded-3xl bg-slate-950/80 px-4 py-3 text-sm text-slate-300 ring-1 ring-slate-700 sm:self-auto hover:ring-slate-500 transition"
          >
            <span className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-300">
              <Bell className="h-5 w-5" />
              {(data?.unread_notifications_count ?? 0) > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-500 px-1 text-xs font-bold text-slate-950">
                  {data.unread_notifications_count}
                </span>
              )}
            </span>
            <div>
              <p className="text-slate-200">Notifications</p>
              <p className="font-semibold text-white">
                {(data?.unread_notifications_count ?? 0) > 0
                  ? `${data.unread_notifications_count} unread`
                  : 'All caught up'}
              </p>
            </div>
          </Link>
        </header>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">

          {/* Sidebar */}
          <aside className="space-y-6 rounded-3xl border border-slate-800 bg-slate-900/95 p-6 shadow-lg shadow-slate-950/20">
            <div className="space-y-4">
              <div className="rounded-3xl bg-slate-950/80 p-4">
                <p className="text-sm uppercase tracking-[0.35em] text-slate-400">Your profile</p>
                <p className="mt-3 text-xl font-semibold text-white">{profile.full_name || 'PlacementOS user'}</p>
                <p className="mt-1 text-sm text-slate-500">{profile.college_name || 'No college set yet'}</p>
                {profile.degree && <p className="mt-0.5 text-sm text-slate-500">{profile.degree}</p>}
              </div>
              <div className="rounded-3xl bg-slate-950/80 p-4">
                <p className="text-sm uppercase tracking-[0.35em] text-slate-400">Readiness</p>
                <p className="mt-3 text-4xl font-semibold text-white">{stats.overall_readiness}%</p>
                <div className="mt-3 h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${stats.overall_readiness}%`,
                      background: 'linear-gradient(90deg, #0ea5e9, #38bdf8)',
                    }}
                  />
                </div>
              </div>
              <div className="rounded-3xl bg-slate-950/80 p-4">
                <p className="text-sm uppercase tracking-[0.35em] text-slate-400">Next milestone</p>
                <p className="mt-3 text-lg font-semibold text-white">{data?.next_milestone ?? 'Complete onboarding profile'}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { logout(); navigate('/login'); }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </aside>

          {/* Main content */}
          <section className="space-y-6">

            {/* Stat cards */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <StatCard label="Overall Readiness" value={`${stats.overall_readiness}%`} subtitle="Based on all your modules" icon={TrendingUp} color="#0ea5e9" />
              <StatCard label="Weekly Tasks" value={`${stats.weekly_tasks_completed}/${stats.weekly_tasks_total}`} subtitle="Tasks completed this week" icon={ClipboardList} color="#8b5cf6" />
              <StatCard label="DSA Solved" value={stats.dsa_solved} subtitle="Problems completed" icon={Code2} color="#22c55e" />
              <StatCard label="Resume Score" value={`${stats.resume_score}%`} subtitle="Profile completeness" icon={FileText} color="#f59e0b" />
              <StatCard label="Applications" value={stats.applications_sent} subtitle="Applications sent" icon={Briefcase} color="#ef4444" />
              <StatCard label="Subjects" value={stats.subjects_completed} subtitle="Topics completed" icon={BookOpen} color="#06b6d4" />
            </div>

            {/* Feature tiles */}
            <div className="grid gap-4 sm:grid-cols-2">
              {tileData.map((tile) => {
                const Icon = tile.icon;
                const Wrapper = tile.link ? Link : 'div';
                const wrapperProps = tile.link ? { to: tile.link } : {};
                return (
                  <Wrapper
                    key={tile.title}
                    {...wrapperProps}
                    className="group rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-sm transition hover:-translate-y-1 hover:border-slate-600 hover:shadow-lg cursor-pointer block"
                  >
                    <div className="flex items-start justify-between">
                      <div
                        className="inline-flex h-12 w-12 items-center justify-center rounded-2xl"
                        style={{ background: `${tile.color}15`, color: tile.color }}
                      >
                        <Icon className="h-6 w-6" />
                      </div>
                      {tile.link && (
                        <ChevronRight className="h-5 w-5 text-slate-600 transition group-hover:text-slate-300 group-hover:translate-x-0.5" />
                      )}
                      {!tile.link && (
                        <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-500">Soon</span>
                      )}
                    </div>
                    <h2 className="mt-5 text-lg font-semibold text-white">{tile.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{tile.text}</p>
                  </Wrapper>
                );
              })}
            </div>

            {/* Focus CTA */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.35em] text-slate-500">Focus</p>
                  <h2 className="mt-3 text-2xl font-semibold text-white">Improve your readiness with a weekly plan</h2>
                </div>
                <Sparkles className="h-8 w-8 text-sky-400" />
              </div>
              <p className="mt-5 text-sm leading-6 text-slate-400">
                Use the planner to break down your interview preparation into small, actionable steps and track progress daily.
              </p>
              <Link
                to="/planner"
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-sky-500 px-6 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-sky-500/20 transition hover:bg-sky-400"
              >
                Open Planner <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
