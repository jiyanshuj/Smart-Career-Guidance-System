import React, { useState, useEffect, useRef } from 'react';
import { ClerkProvider, SignInButton, SignUpButton, UserButton, useUser, useAuth } from '@clerk/clerk-react';
import HomePage from './components/Home';
import ProfilePage from './components/Profile';
import QuizPage from './components/Quiz';
import QuizConfig from './components/QuizConfig';
import ResultPage from './components/ResultPage';
import { Home, User } from 'lucide-react';

const CLERK_PUBLISHABLE_KEY = 'pk_test_Y29udGVudC1lbXUtMTguY2xlcmsuYWNjb3VudHMuZGV2JA';
const API_BASE = 'http://127.0.0.1:5000/api';

// Floating Stars Background Component
const FloatingStarsBackground = () => {
  const canvasRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const starsRef = useRef([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const animationRef = useRef(null);

  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);

    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (!dimensions.width || !dimensions.height) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    if (starsRef.current.length === 0) {
      starsRef.current = Array.from({ length: 150 }, () => ({
        x: Math.random() * dimensions.width,
        y: Math.random() * dimensions.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 2.5 + 0.5,
        opacity: Math.random() * 0.5 + 0.3,
        twinkleSpeed: Math.random() * 0.02 + 0.01
      }));
    }

    const handleMouseMove = (e) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    window.addEventListener('mousemove', handleMouseMove);

    const animate = () => {
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      starsRef.current.forEach((star) => {
        star.x += star.vx;
        star.y += star.vy;

        if (star.x < 0) star.x = dimensions.width;
        if (star.x > dimensions.width) star.x = 0;
        if (star.y < 0) star.y = dimensions.height;
        if (star.y > dimensions.height) star.y = 0;

        star.opacity += star.twinkleSpeed;
        if (star.opacity > 0.8 || star.opacity < 0.2) {
          star.twinkleSpeed *= -1;
        }

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
        ctx.fill();
      });

      const maxDistance = 120;
      ctx.lineWidth = 1;

      for (let i = 0; i < starsRef.current.length; i++) {
        for (let j = i + 1; j < starsRef.current.length; j++) {
          const star1 = starsRef.current[i];
          const star2 = starsRef.current[j];
          
          const dx = star1.x - star2.x;
          const dy = star1.y - star2.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < maxDistance) {
            const opacity = (1 - distance / maxDistance) * 0.3;
            ctx.strokeStyle = `rgba(59, 130, 246, ${opacity})`;
            ctx.beginPath();
            ctx.moveTo(star1.x, star1.y);
            ctx.lineTo(star2.x, star2.y);
            ctx.stroke();
          }
        }
      }

      const mouseMaxDistance = 150;
      starsRef.current.forEach((star) => {
        const dx = mouseRef.current.x - star.x;
        const dy = mouseRef.current.y - star.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < mouseMaxDistance) {
          const opacity = (1 - distance / mouseMaxDistance) * 0.5;
          ctx.strokeStyle = `rgba(168, 85, 247, ${opacity})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(mouseRef.current.x, mouseRef.current.y);
          ctx.lineTo(star.x, star.y);
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(star.x, star.y, star.size + 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(168, 85, 247, ${opacity * 0.3})`;
          ctx.fill();
        }
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [dimensions]);

  return (
    <canvas
      ref={canvasRef}
      width={dimensions.width}
      height={dimensions.height}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ background: 'transparent' }}
    />
  );
};

const NavBar = ({ page, setPage, scrollY }) => {
  const isScrolled = scrollY > 50;

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-black/80 backdrop-blur-md border-b border-white/10' : 'bg-black/60 backdrop-blur-sm border-b border-white/5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-6">
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">CareerQuiz</h1>
            <div className="flex gap-4">
              <button
                onClick={() => setPage('home')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  page === 'home'
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                    : 'text-gray-300 hover:bg-white/10'
                }`}
              >
                <Home className="w-4 h-4" />
                Home
              </button>
              <button
                onClick={() => setPage('profile')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  page === 'profile'
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                    : 'text-gray-300 hover:bg-white/10'
                }`}
              >
                <User className="w-4 h-4" />
                Profile
              </button>
            </div>
          </div>
          <UserButton afterSignOutUrl="/" />
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
  const [scrollY, setScrollY] = useState(0);
  const [quizConfig, setQuizConfig] = useState({ difficulty: 'moderate', language: 'python' });

  const auth = { getToken };

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (isSignedIn && user && !synced) {
      syncUser();
    }
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

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-black relative overflow-hidden">
        <FloatingStarsBackground />
        <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
          <div className="text-center">
            <h1 className="text-6xl font-bold text-white mb-6">Career Aptitude Quiz</h1>
            <p className="text-xl text-gray-300 mb-8">
              Discover your ideal tech career path with AI-powered insights
            </p>
            <div className="flex gap-4 justify-center">
              <SignInButton mode="modal">
                <button className="bg-white text-black px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-200 transition-all transform hover:scale-105 shadow-lg">
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:from-blue-600 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg">
                  Sign Up
                </button>
              </SignUpButton>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderPage = () => {
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
          onComplete={(res) => {
            setResult(res);
            setPage('result');
          }}
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
          onRetakeQuiz={() => {
            setResult(null);
            setPage('config');
          }}
          onViewProfile={() => setPage('profile')}
        />
      );
    }

    if (page === 'profile') {
      return <ProfilePage auth={auth} />;
    }

    return <HomePage onStartQuiz={() => setPage('config')} />;
  };

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      <FloatingStarsBackground />
      
      {page !== 'quiz' && page !== 'result' && page !== 'config' && (
        <NavBar page={page} setPage={setPage} scrollY={scrollY} />
      )}
      
      <div className={`relative z-10 ${page !== 'quiz' && page !== 'result' && page !== 'config' ? 'pt-20' : ''}`}>
        {renderPage()}
      </div>
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