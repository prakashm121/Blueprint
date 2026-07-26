import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { ArrowLeft, Map, Circle, Sparkles, BookOpen } from 'lucide-react';

export default function Roadmap() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/v1/profile/roadmap')
      .then(res => setData(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-pulse text-slate-400 text-lg flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-sky-400" /> Generating your targeted roadmap...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-12 selection:bg-sky-500/30">
      <div className="w-full border-b border-slate-900 px-6 py-4 flex items-center justify-between bg-slate-950/80 backdrop-blur sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Link
            to="/dashboard"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/80 text-slate-400 transition hover:border-slate-600 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">Role Roadmap</h1>
            <p className="text-[11px] text-sky-400 uppercase tracking-wider font-semibold">
              {data?.target_role || "Loading..."}
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-10 text-center">
          <div className="mx-auto w-16 h-16 bg-sky-500/10 rounded-2xl flex items-center justify-center mb-4">
            <Map className="w-8 h-8 text-sky-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Your Path to {data?.target_role}</h2>
          <p className="text-sm text-slate-400">
            A comprehensive, step-by-step guide from beginner to advanced. Follow this roadmap in tandem with your Weekly Planner.
          </p>
        </div>

        <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-800 before:to-transparent">
          {data?.roadmap?.map((phase, index) => (
            <div key={index} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
              <div className="flex items-center justify-center w-10 h-10 rounded-full border border-slate-800 bg-slate-950 text-slate-400 shadow shrink-0 z-10 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                <BookOpen className="w-4 h-4" />
              </div>
              <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-5 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur transition hover:border-slate-700">
                <h3 className="text-sm font-bold text-white mb-1">{phase.phase}</h3>
                <p className="text-xs text-slate-400 mb-4">{phase.description}</p>
                <ul className="space-y-2">
                  {phase.topics?.map((topic, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                      <Circle className="w-3.5 h-3.5 text-sky-500 mt-0.5 shrink-0" />
                      {topic}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
