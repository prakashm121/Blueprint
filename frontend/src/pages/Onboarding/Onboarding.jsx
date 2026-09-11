import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { ChevronRight, Sparkles, Target, GraduationCap, Check, Map } from 'lucide-react';

const STEPS = ['profile', 'assessment', 'goals', 'roadmap'];

// Calibration hints shown below each slider to help students rate accurately
const CONFIDENCE_HINTS = {
  operating_systems: 'Can you explain process scheduling, deadlocks, and virtual memory?',
  dbms: 'Can you write complex SQL joins, explain normalization, and discuss indexing?',
  computer_networks: 'Do you know how TCP/IP, DNS, and HTTP/HTTPS work end to end?',
  system_design: 'Can you design a URL shortener or chat app with scale in mind?',
  arrays_strings: 'Can you solve Two Sum, Sliding Window, and prefix sum problems?',
  trees_graphs: 'Can you traverse trees and graphs, and implement BFS/DFS from scratch?',
  dynamic_programming: 'Can you identify DP sub-problems and solve knapsack or LCS?',
  sorting_searching: 'Can you implement binary search and explain quicksort/mergesort?',
};

function StepIndicator({ current }) {
  const idx = STEPS.indexOf(current);
  return (
    <div className="mb-8 flex items-center justify-center gap-2">
      {STEPS.map((step, i) => (
        <div key={step} className="flex items-center gap-2">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
            i <= idx ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-500'
          }`}>
            {i < idx ? <Check className="h-4 w-4" /> : i + 1}
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-0.5 w-8 ${i < idx ? 'bg-sky-500' : 'bg-slate-800'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function ConfidenceSlider({ skillKey, label, value, onChange }) {
  const hint = CONFIDENCE_HINTS[skillKey];
  const color = value >= 70 ? 'text-emerald-400' : value >= 40 ? 'text-amber-400' : 'text-red-400';
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-200">{label}</span>
        <span className={`text-sm font-semibold ${color}`}>{value}%</span>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        step="5"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-sky-500"
      />
      {hint && (
        <p className="mt-2 text-xs text-slate-500 leading-relaxed italic">{hint}</p>
      )}
    </div>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState('profile');
  const [error, setError] = useState('');
  const [catalog, setCatalog] = useState(null);
  const [profileData, setProfileData] = useState({
    college_name: '', degree: '', graduation_year: '', cgpa: '',
  });
  const [confidence, setConfidence] = useState({});
  const [goals, setGoals] = useState({ target_role: '', target_companies: [] });
  const [generating, setGenerating] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/api/v1/onboarding/status').catch(() => ({ data: {} })),
      api.get('/api/v1/onboarding/catalog').catch(() => ({ data: null })),
      api.get('/api/v1/assessments/subjects').catch(() => ({ data: null }))
    ]).then(([statusRes, catalogRes, subjectsRes]) => {
      const s = statusRes.data?.onboarding_step;
      if (s === 'completed') {
        navigate('/roadmap', { replace: true });
        return;
      }
      if (s && STEPS.includes(s)) setStep(s);
      else if (s === 'generate_roadmap') setStep('roadmap');

      // Build a map of existing confidences if the user has already saved some
      const existingMap = {};
      if (subjectsRes.data) {
        [...(subjectsRes.data.subjects || []), ...(subjectsRes.data.dsa || [])].forEach((item) => {
          existingMap[item.skill_key] = item.confidence;
        });
      }

      const catData = catalogRes.data;
      if (catData) {
        setCatalog(catData);
        const initial = {};
        [...(catData.subjects || []), ...(catData.dsa_topics || [])].forEach((item) => {
          initial[item.key] = existingMap[item.key] !== undefined ? existingMap[item.key] : 50;
        });
        setConfidence(initial);
        if (!goals.target_role && catData.target_roles?.length) {
          setGoals((g) => ({ ...g, target_role: catData.target_roles[0] }));
        }
      }
      setInitialLoading(false);
    });
  }, [navigate]);

  const saveProfile = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.patch('/api/v1/profile/', profileData);
      setStep('assessment');
    } catch {
      setError('Failed to save profile. Please try again.');
    }
  };

  const saveAssessment = async () => {
    setError('');
    if (!catalog) return;
    const responses = [
      ...catalog.subjects.map((s) => ({
        skill_key: s.key, skill_type: 'subject', self_rated_confidence: confidence[s.key] ?? 50,
      })),
      ...catalog.dsa_topics.map((d) => ({
        skill_key: d.key, skill_type: 'dsa', self_rated_confidence: confidence[d.key] ?? 50,
      })),
    ];
    try {
      await api.post('/api/v1/onboarding/assessment', { responses });
      setStep('goals');
    } catch {
      setError('Failed to save assessment.');
    }
  };

  const saveGoals = async () => {
    setError('');
    try {
      await api.post('/api/v1/onboarding/goals', goals);
      setStep('roadmap');
    } catch {
      setError('Failed to save goals.');
    }
  };

  // Single await — no polling, no setTimeout, no freeze
  const generateRoadmap = async () => {
    setGenerating(true);
    setError('');
    try {
      await api.post('/api/v1/onboarding/generate-roadmap');
      navigate('/roadmap', { replace: true });
    } catch {
      setError('Failed to generate your roadmap. Please try again.');
      setGenerating(false);
    }
  };

  const skipToRoadmap = () => {
    // Navigate unconditionally — works even if generating was somehow true
    navigate('/roadmap', { replace: true });
  };

  const toggleCompany = (name) => {
    setGoals((g) => ({
      ...g,
      target_companies: g.target_companies.includes(name)
        ? g.target_companies.filter((c) => c !== name)
        : [...g.target_companies, name].slice(0, 5),
    }));
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-sky-500 border-t-transparent animate-spin mb-4"></div>
        <p className="text-sm text-slate-400 font-medium tracking-widest uppercase">Loading Onboarding...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-2xl rounded-3xl border border-slate-800 bg-slate-900/95 p-8 shadow-2xl shadow-slate-950/40 backdrop-blur">
        <div className="mb-4 space-y-3 text-center">
          <p className="text-sm uppercase tracking-[0.35em] text-sky-400/80">Onboarding</p>
          <h1 className="text-3xl font-semibold text-white">
            {step === 'profile' && 'Complete your profile'}
            {step === 'assessment' && 'Rate your confidence'}
            {step === 'goals' && 'Set your career goals'}
            {step === 'roadmap' && 'Generate your roadmap'}
          </h1>
        </div>

        <StepIndicator current={step} />
        {error && <div className="mb-4 rounded-2xl border border-red-600/20 bg-red-600/10 px-4 py-3 text-sm text-red-200">{error}</div>}

        {step === 'profile' && (
          <form onSubmit={saveProfile} className="grid gap-5">
            {[
              { label: 'College / University', name: 'college_name', type: 'text', required: true },
              { label: 'Degree (e.g., B.Tech)', name: 'degree', type: 'text' },
              { label: 'Graduation Year', name: 'graduation_year', type: 'number' },
              { label: 'Current CGPA', name: 'cgpa', type: 'number', step: '0.01' },
            ].map((field) => (
              <label key={field.name} className="block text-sm font-medium text-slate-200">
                {field.label}
                <input
                  type={field.type}
                  step={field.step}
                  className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20"
                  value={profileData[field.name]}
                  onChange={(e) => setProfileData({
                    ...profileData,
                    [field.name]: field.type === 'number' ? (e.target.value ? Number(e.target.value) : '') : e.target.value,
                  })}
                  required={field.required}
                />
              </label>
            ))}
            <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-500 px-4 py-3 text-base font-semibold text-slate-950 transition hover:bg-sky-400">
              Continue <ChevronRight className="h-4 w-4" />
            </button>
          </form>
        )}

        {step === 'assessment' && catalog && (
          <div className="space-y-6">
            <div>
              <p className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-300">
                <GraduationCap className="h-4 w-4 text-sky-400" /> Core Subjects
              </p>
              <div className="space-y-3">
                {catalog.subjects.map((s) => (
                  <ConfidenceSlider
                    key={s.key}
                    skillKey={s.key}
                    label={s.label}
                    value={confidence[s.key] ?? 50}
                    onChange={(v) => setConfidence({ ...confidence, [s.key]: v })}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-3 text-sm font-medium text-slate-300">DSA Topics</p>
              <div className="space-y-3">
                {catalog.dsa_topics.map((d) => (
                  <ConfidenceSlider
                    key={d.key}
                    skillKey={d.key}
                    label={d.label}
                    value={confidence[d.key] ?? 50}
                    onChange={(v) => setConfidence({ ...confidence, [d.key]: v })}
                  />
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={saveAssessment}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-500 px-4 py-3 text-base font-semibold text-slate-950 transition hover:bg-sky-400"
            >
              Continue <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {step === 'goals' && catalog && (
          <div className="space-y-6">
            <label className="block text-sm font-medium text-slate-200">
              Target role
              <select
                className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-sky-400"
                value={goals.target_role}
                onChange={(e) => setGoals({ ...goals, target_role: e.target.value })}
              >
                {catalog.target_roles.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <div>
              <p className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-200">
                <Target className="h-4 w-4 text-sky-400" /> Target companies (pick up to 5)
              </p>
              <div className="flex flex-wrap gap-2">
                {catalog.sample_companies.map((co) => (
                  <button
                    key={co}
                    type="button"
                    onClick={() => toggleCompany(co)}
                    className={`rounded-xl px-3 py-1.5 text-sm font-medium transition ${
                      goals.target_companies.includes(co)
                        ? 'bg-sky-500 text-slate-950'
                        : 'border border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {co}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={saveGoals}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-500 px-4 py-3 text-base font-semibold text-slate-950 transition hover:bg-sky-400"
            >
              Continue <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {step === 'roadmap' && (
          <div className="text-center space-y-6">
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-sky-500/10 text-sky-300 mx-auto">
              {generating ? (
                <div className="w-10 h-10 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
              ) : (
                <Map className="h-10 w-10" />
              )}
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-white">
                {generating ? 'Building your personalized roadmap…' : 'Ready to map your journey?'}
              </h2>
              <p className="text-slate-400 leading-6 text-sm">
                {generating
                  ? 'Our AI is analysing your weak areas and career goals. This takes 10–20 seconds.'
                  : 'We\'ll generate a role-specific milestone roadmap tailored to your skills and target companies.'}
              </p>
            </div>
            <button
              type="button"
              onClick={generateRoadmap}
              disabled={generating}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-500 px-4 py-3 text-base font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? 'Generating…' : <><Sparkles className="h-4 w-4" /> Generate my roadmap</>}
            </button>
            <button
              type="button"
              onClick={skipToRoadmap}
              className="text-sm text-slate-500 hover:text-slate-300 transition"
            >
              Skip for now → Go to roadmap
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
