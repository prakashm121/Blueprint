export default function ResumeAnalyser() {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-background-deep text-on-surface p-6 min-h-[500px]">
      <div className="max-w-2xl text-center space-y-6">
        <div className="bg-primary/10 p-6 rounded-full inline-flex">
          <span className="material-symbols-outlined text-6xl text-primary">description</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight">Resume Analyser</h1>
        <p className="text-on-surface-variant text-lg">
          This feature is currently under development. Soon, you'll be able to upload your resume and get AI-powered feedback, ATS scoring, and targeted improvement suggestions tailored to your desired role!
        </p>
      </div>
    </div>
  );
}
