import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import {
  Plus, Check, Trash2, ChevronRight, Clock, Zap,
  LayoutList, ArrowLeft, Sparkles, Target
} from 'lucide-react';

const CATEGORY_COLORS = {
  DSA: { bg: 'rgba(168,85,247,0.12)', text: '#c084fc', border: 'rgba(168,85,247,0.25)' },
  Subjects: { bg: 'rgba(59,130,246,0.12)', text: '#93c5fd', border: 'rgba(59,130,246,0.25)' },
  Resume: { bg: 'rgba(34,197,94,0.12)', text: '#86efac', border: 'rgba(34,197,94,0.25)' },
  Projects: { bg: 'rgba(251,146,60,0.12)', text: '#fdba74', border: 'rgba(251,146,60,0.25)' },
  'Company Preparation': { bg: 'rgba(244,63,94,0.12)', text: '#fda4af', border: 'rgba(244,63,94,0.25)' },
  'Mock Interview': { bg: 'rgba(14,165,233,0.12)', text: '#7dd3fc', border: 'rgba(14,165,233,0.25)' },
  Revision: { bg: 'rgba(234,179,8,0.12)', text: '#fde047', border: 'rgba(234,179,8,0.25)' },
  Custom: { bg: 'rgba(148,163,184,0.12)', text: '#cbd5e1', border: 'rgba(148,163,184,0.25)' },
};

const PRIORITY_ICONS = {
  Critical: '🔴',
  High: '🟠',
  Medium: '🟡',
  Low: '🟢',
};

export default function Planner() {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', category: 'Custom', priority: 'Medium', estimated_minutes: 30 });

  const fetchPlan = async () => {
    try {
      const res = await api.get('/api/v1/planner/plans');
      setPlan(res.data);
    } catch {
      setPlan(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPlan(); }, []);

  const createPlan = async () => {
    setCreating(true);
    try {
      const res = await api.post('/api/v1/planner/plans', { title: 'My Weekly Plan' });
      setPlan(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const toggleTask = async (task) => {
    const newStatus = task.status === 'Completed' ? 'Pending' : 'Completed';
    try {
      await api.patch(`/api/v1/planner/tasks/${task.id}`, { status: newStatus });
      fetchPlan();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteTask = async (taskId) => {
    try {
      await api.delete(`/api/v1/planner/tasks/${taskId}`);
      fetchPlan();
    } catch (err) {
      console.error(err);
    }
  };

  const addTask = async (e) => {
    e.preventDefault();
    if (!plan || !newTask.title.trim()) return;
    try {
      await api.post(`/api/v1/planner/plans/${plan.id}/tasks`, newTask);
      setNewTask({ title: '', category: 'Custom', priority: 'Medium', estimated_minutes: 30 });
      setShowAddTask(false);
      fetchPlan();
    } catch (err) {
      console.error(err);
    }
  };

  const completedCount = plan?.tasks?.filter(t => t.status === 'Completed').length || 0;
  const totalCount = plan?.tasks?.length || 0;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-pulse text-slate-400 text-lg">Loading planner...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-6 py-8 lg:px-8">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/dashboard"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/80 text-slate-400 transition hover:border-slate-600 hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-sky-400/80">Planner</p>
              <h1 className="text-3xl font-semibold text-white">Weekly Plan</h1>
            </div>
          </div>
          {plan && (
            <button
              onClick={() => setShowAddTask(!showAddTask)}
              className="inline-flex items-center gap-2 rounded-2xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-sky-500/20 transition hover:bg-sky-400"
            >
              <Plus className="h-4 w-4" /> Add Task
            </button>
          )}
        </div>

        {/* No plan state */}
        {!plan && (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-800 bg-slate-900/95 p-16 shadow-2xl shadow-slate-950/40 backdrop-blur text-center">
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-sky-500/10 text-sky-300 mb-6">
              <Sparkles className="h-10 w-10" />
            </div>
            <h2 className="text-2xl font-semibold text-white mb-3">No active plan yet</h2>
            <p className="max-w-md text-slate-400 mb-8">Create your first weekly plan to start organizing your placement preparation with actionable tasks.</p>
            <button
              onClick={createPlan}
              disabled={creating}
              className="inline-flex items-center gap-2 rounded-2xl bg-sky-500 px-8 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-sky-500/20 transition hover:bg-sky-400 disabled:opacity-50"
            >
              {creating ? 'Creating...' : (
                <><Zap className="h-5 w-5" /> Generate Weekly Plan</>
              )}
            </button>
          </div>
        )}

        {/* Active plan */}
        {plan && (
          <div className="space-y-6">

            {/* Progress bar card */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl shadow-slate-950/40 backdrop-blur">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-300">
                    <Target className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">{plan.title}</h2>
                    <p className="text-sm text-slate-400">{plan.start_date} → {plan.end_date}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-semibold text-white">{progressPct}%</p>
                  <p className="text-sm text-slate-400">{completedCount}/{totalCount} tasks</p>
                </div>
              </div>
              <div className="h-3 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${progressPct}%`,
                    background: 'linear-gradient(90deg, #0ea5e9, #38bdf8, #7dd3fc)',
                  }}
                />
              </div>
            </div>

            {/* Add task form */}
            {showAddTask && (
              <form
                onSubmit={addTask}
                className="rounded-3xl border border-sky-500/30 bg-slate-900/95 p-6 shadow-lg backdrop-blur animate-in"
              >
                <h3 className="text-lg font-semibold text-white mb-4">New Task</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-200 sm:col-span-2">
                    Title
                    <input
                      type="text"
                      className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20"
                      value={newTask.title}
                      onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                      placeholder="e.g. Solve 5 graph problems"
                      required
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-200">
                    Category
                    <select
                      className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-sky-400"
                      value={newTask.category}
                      onChange={e => setNewTask({ ...newTask, category: e.target.value })}
                    >
                      {Object.keys(CATEGORY_COLORS).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-slate-200">
                    Priority
                    <select
                      className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-sky-400"
                      value={newTask.priority}
                      onChange={e => setNewTask({ ...newTask, priority: e.target.value })}
                    >
                      <option value="Low">🟢 Low</option>
                      <option value="Medium">🟡 Medium</option>
                      <option value="High">🟠 High</option>
                      <option value="Critical">🔴 Critical</option>
                    </select>
                  </label>
                </div>
                <div className="mt-4 flex gap-3">
                  <button type="submit" className="rounded-2xl bg-sky-500 px-6 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400">
                    Add Task
                  </button>
                  <button type="button" onClick={() => setShowAddTask(false)} className="rounded-2xl border border-slate-700 px-6 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-slate-500">
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Task list */}
            <div className="space-y-3">
              {plan.tasks?.sort((a, b) => a.display_order - b.display_order).map(task => {
                const cat = CATEGORY_COLORS[task.category] || CATEGORY_COLORS.Custom;
                const isDone = task.status === 'Completed';
                return (
                  <div
                    key={task.id}
                    className={`group relative flex items-center gap-4 rounded-2xl border p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                      isDone
                        ? 'border-slate-800/50 bg-slate-900/50 opacity-60'
                        : 'border-slate-800 bg-slate-900/90'
                    }`}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleTask(task)}
                      className={`flex-shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-xl border-2 transition ${
                        isDone
                          ? 'border-sky-500 bg-sky-500 text-white'
                          : 'border-slate-600 hover:border-sky-400'
                      }`}
                    >
                      {isDone && <Check className="h-4 w-4" />}
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-base font-medium ${isDone ? 'line-through text-slate-500' : 'text-white'}`}>
                          {task.title}
                        </span>
                        <span
                          className="inline-flex items-center rounded-lg px-2.5 py-0.5 text-xs font-medium"
                          style={{
                            background: cat.bg,
                            color: cat.text,
                            border: `1px solid ${cat.border}`,
                          }}
                        >
                          {task.category}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                        <span>{PRIORITY_ICONS[task.priority] || '⚪'} {task.priority}</span>
                        {task.estimated_minutes && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {task.estimated_minutes}min
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Delete */}
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Empty task state */}
            {plan.tasks?.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <LayoutList className="h-12 w-12 mx-auto mb-4 opacity-40" />
                <p>No tasks yet. Click "Add Task" to get started!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
