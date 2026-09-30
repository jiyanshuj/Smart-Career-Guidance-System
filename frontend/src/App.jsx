import React, { useState, useEffect } from 'react';
import { ClerkProvider, SignInButton, SignUpButton, UserButton, useUser, useAuth } from '@clerk/clerk-react';
import HomePage from './components/Home';
import ProfilePage from './components/Profile';
import QuizPage from './components/Quiz';
import QuizConfig from './components/QuizConfig';
import ResultPage from './components/ResultPage';
import VortexBackground from './components/VortexBackground';
import { ChevronsRight, Sparkles } from 'lucide-react';

const CLERK_PUBLISHABLE_KEY = 'pk_test_Y29udGVudC1lbXUtMTguY2xlcmsuYWNjb3VudHMuZGV2JA';
const API_BASE = 'https://smart-career-guidance-system-thig.onrender.com/api';

const NavBar = ({ page, setPage, isSignedIn, scrolled }) => {
  const link = (active) =>
    `group relative text-[15px] font-medium tracking-[-0.02em] transition-all duration-200 ${
      active ? 'text-white' : 'text-white/65 hover:text-white'
    } after:absolute after:-bottom-2 after:left-1/2 after:h-px after:w-[calc(100%+8px)] after:-translate-x-1/2 after:bg-white/80 after:transition-transform after:duration-200 ${
      active ? 'after:scale-x-100' : 'after:scale-x-0 group-hover:after:scale-x-100'
    }`;

  return (
    <nav className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled ? 'px-3 pt-3' : 'px-0 pt-0'}`}>
      <div
        className={`mx-auto grid max-w-[1500px] items-center transition-all duration-300 ${
          scrolled
            ? 'grid-cols-[1fr_auto_1fr] rounded-[26px] border border-white/15 bg-black/80 px-6 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-md'
            : 'grid-cols-[1fr_auto_1fr] border-b border-white/5 bg-transparent px-6 py-3.5 shadow-none backdrop-blur-none'
        }`}
      >
        {/* Logo */}
        <button
          onClick={() => setPage('home')}
          title="smart-career-guidance-system"
          aria-label="Smart Career Guidance System home"
          className="group flex items-center gap-3 justify-self-start transition-opacity duration-200 hover:opacity-90"
        >
          <span className={`grid place-items-center bg-white text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] transition-transform duration-200 group-hover:rotate-6 ${
            scrolled ? 'h-7 w-7 rounded-md border border-white/20' : 'h-6 w-6 rounded-sm border border-white/15'
          }`}>
            <Sparkles className={scrolled ? 'h-4 w-4' : 'h-3.5 w-3.5'} strokeWidth={2.8} />
          </span>
          <span className="hidden font-semibold uppercase tracking-[0.12em] text-white min-[420px]:block sm:text-[15px]">
            Smart Career
          </span>
          <span className="sr-only">Guidance System</span>
        </button>

        {/* Centered links */}
        <div className="flex items-center gap-7">
          <button onClick={() => setPage('home')} className={link(page === 'home')}>Home</button>
          {isSignedIn && (
            <button onClick={() => setPage('profile')} className={link(page === 'profile')}>Profile</button>
          )}
        </div>

        {/* Auth */}
        <div className="flex items-center gap-3 justify-self-end">
          {isSignedIn ? (
            <UserButton afterSignOutUrl="/" />
          ) : (
            <>
              <SignInButton mode="modal">
                <button className="rounded-full px-3 py-2 text-[15px] font-medium text-white/70 transition-all duration-200 hover:text-white hover:bg-white/5">
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className={`inline-flex items-center gap-2 rounded-full border text-white transition-all duration-200 hover:-translate-y-0.5 ${
                  scrolled
                    ? 'border-white/20 bg-white/5 px-5 py-2.5 text-[12px] uppercase tracking-[0.12em] hover:bg-white/10 hover:shadow-[0_0_14px_rgba(255,255,255,0.08)]'
                    : 'border-white/20 bg-white/5 px-5 py-2.5 text-[12px] uppercase tracking-[0.12em] hover:bg-white/10 hover:shadow-[0_0_14px_rgba(255,255,255,0.08)]'
                }`}>
                  Get Started <ChevronsRight className="h-3.5 w-3.5" />
                </button>
              </SignUpButton>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

const AppContent = () => {
  const { isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const [page, setPage] = useState('home');
  const [result, setResult] = useState(null);
  const [synced, setSynced] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [quizConfig, setQuizConfig] = useState({ difficulty: 'moderate', language: 'python' });

  const auth = { getToken };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (isSignedIn && user && !synced) syncUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, user]);

  const syncUser = async () => {
    try {
      await fetch(`${API_BASE}/auth/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clerk_id: user.id,
          email: user.primaryEmailAddress?.emailAddress,
          name: user.fullName || user.firstName || 'User',
        }),
      });
      setSynced(true);
    } catch (error) {
      console.error('Failed to sync user:', error);
    }
  };

  const handleStartQuiz = () => {
    if (!isSignedIn) return; // Clerk modal handles sign-in
    setPage('config');
  };

  const renderPage = () => {
    if (!isSignedIn && ['config', 'quiz', 'result', 'profile'].includes(page)) {
      return <HomePage onStartQuiz={handleStartQuiz} />;
    }

    if (page === 'config') {
      return (
        <QuizConfig
          onStart={(difficulty, language) => {
            setQuizConfig({ difficulty, language });
            setPage('quiz');
          }}
          onBack={() => setPage('home')}
        />
      );
    }

    if (page === 'quiz') {
      return (
        <QuizPage
          onComplete={(res) => { setResult(res); setPage('result'); }}
          auth={auth}
          difficulty={quizConfig.difficulty}
          language={quizConfig.language}
        />
      );
    }

    if (page === 'result' && result) {
      return (
        <ResultPage
          result={result}
          onRetakeQuiz={() => { setResult(null); setPage('config'); }}
          onViewProfile={() => setPage('profile')}
        />
      );
    }

    if (page === 'profile') return <ProfilePage auth={auth} />;

    return <HomePage onStartQuiz={handleStartQuiz} />;
  };

  const showNav = !['quiz', 'result', 'config'].includes(page);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-black font-sans text-white">
      {/* ONE shared background for every page */}
      <VortexBackground />

      {showNav && <NavBar page={page} setPage={setPage} isSignedIn={isSignedIn} scrolled={scrolled} />}

      <div className={`relative z-10 ${showNav ? 'pt-20' : ''}`}>{renderPage()}</div>
    </div>
  );
};

export default function App() {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <AppContent />
    </ClerkProvider>
  );
}