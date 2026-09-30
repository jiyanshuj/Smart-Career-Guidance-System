import React from 'react';
import { SignInButton, useUser } from '@clerk/clerk-react';
import { Code, Brain, Target, BookOpen, ChevronsRight } from 'lucide-react';

// Pill CTA (outlined, with gradient rim like the reference)
const PrimaryCTA = ({ children, onClick }) => (
  <button
    onClick={onClick}
    className="group inline-flex items-center gap-2 rounded-full border border-white/40 bg-black px-6 py-3 text-sm font-medium uppercase tracking-wide text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] transition hover:border-white hover:bg-white/10"
  >
    {children}
    <ChevronsRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
  </button>
);

// Start button with auth logic (same behaviour as before)
const StartAssessmentButton = ({ onStartQuiz, label = 'Get Started' }) => {
  const { isSignedIn } = useUser();
  if (isSignedIn) return <PrimaryCTA onClick={onStartQuiz}>{label}</PrimaryCTA>;
  return (
    <SignInButton mode="modal">
      <PrimaryCTA>{label}</PrimaryCTA>
    </SignInButton>
  );
};

const glass = 'rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md';

const HomePage = ({ onStartQuiz }) => {
  const scrollToHow = () =>
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="relative">
      {/* ===== HERO ===== */}
      <section className="flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center px-4 text-center">
        <h1 className="font-sans text-5xl font-normal leading-[1.05] tracking-tight text-white md:text-7xl">
          <span className="block">Discover your ideal</span>
          {/* second line fades to grey from top to bottom, like the reference */}
          <span className="block bg-gradient-to-b from-white to-white/40 bg-clip-text text-transparent">
            tech career path
          </span>
        </h1>

        <p className="mt-8 max-w-xl text-base leading-relaxed text-gray-200 md:text-lg">
          A 30-question aptitude test across programming, analytics, testing and core CS.
          Instant, AI-powered insight into where you fit best.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <StartAssessmentButton onStartQuiz={onStartQuiz} label="Get Started" />
          <button
            onClick={scrollToHow}
            className="rounded-full bg-white px-6 py-3 text-sm font-medium uppercase tracking-wide text-black transition hover:bg-gray-200"
          >
            How it works
          </button>
        </div>

        {/* Domain strip (replaces the logo row in the reference) */}
        <div className="mt-24 flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-gray-300/80">
          {[
            { icon: Code, t: 'Programming' },
            { icon: Brain, t: 'Analytics' },
            { icon: Target, t: 'Testing' },
            { icon: BookOpen, t: 'Technical' },
          ].map(({ icon: Icon, t }) => (
            <div key={t} className="flex items-center gap-2 text-lg font-semibold">
              {React.createElement(Icon, { className: 'h-5 w-5' })} {t}
            </div>
          ))}
        </div>
      </section>

      {/* ===== CONTENT ===== */}
      <div className="mx-auto max-w-7xl px-4 pb-24">
        {/* How it works */}
        <div id="how-it-works" className={`${glass} mb-20 p-12`}>
          <h2 className="mb-12 text-center text-4xl font-normal tracking-tight text-white">How it works</h2>
          <div className="grid gap-8 md:grid-cols-4">
            {[
              ['1', 'Configure', 'Choose difficulty and programming language'],
              ['2', 'Take test', '30 questions across multiple domains'],
              ['3', 'Get results', 'Receive AI-powered analysis instantly'],
              ['4', 'Improve', 'Track progress and retake to improve'],
            ].map(([n, title, desc]) => (
              <div key={n} className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-white/40 text-xl text-white">
                  {n}
                </div>
                <h4 className="mb-1 text-lg font-semibold text-white">{title}</h4>
                <p className="text-sm text-gray-400">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Final CTA */}
        <div className={`${glass} p-12 text-center`}>
          <h2 className="mb-3 text-4xl font-normal tracking-tight text-white">Ready to find your path?</h2>
          <p className="mb-8 text-lg text-gray-300">Join thousands discovering their ideal tech career.</p>
          <StartAssessmentButton onStartQuiz={onStartQuiz} label="Start your assessment" />
        </div>
      </div>
    </div>
  );
};

export default HomePage;