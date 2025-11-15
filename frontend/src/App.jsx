import React, { useState, useEffect } from 'react';
import { ClerkProvider, SignInButton, SignUpButton, UserButton, useUser, useAuth } from '@clerk/clerk-react';
import HomePage from './components/Home';
import ProfilePage from './components/Profile';
import QuizPage from './components/Quiz';
import QuizConfig from './components/QuizConfig';
import ResultPage from './components/ResultPage';
import { Home, User } from 'lucide-react';

const CLERK_PUBLISHABLE_KEY = 'pk_test_Y29udGVudC1lbXUtMTguY2xlcmsuYWNjb3VudHMuZGV2JA';
const API_BASE = 'http://localhost:5000/api';

// Animated Background Component
const AnimatedBackground = () => {
  const [stars, setStars] = useState([]);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // Generate random stars
    const newStars = Array.from({ length: 100 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      size: Math.random() * 2 + 1,
    }));
    setStars(newStars);

    const handleMouseMove = (e) => {
      setMouse({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const getConnectedStars = () => {
    const connections = [];
    const maxDistance = 150;

    // Connect mouse to nearby stars
    stars.forEach((star, i) => {
      const dx = mouse.x - star.x;
      const dy = mouse.y - star.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < maxDistance) {
        connections.push({
          from: mouse,
          to: star,
          opacity: (1 - distance / maxDistance) * 0.5,
        });
      }
    });

    // Connect nearby stars to each other
    for (let i = 0; i < stars.length; i++) {
      for (let j = i + 1; j < stars.length; j++) {
        const dx = stars[i].x - stars[j].x;
        const dy = stars[i].y - stars[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 100) {
          connections.push({
            from: stars[i],
            to: stars[j],
            opacity: (1 - distance / 100) * 0.2,
          });
        }
      }
    }

    return connections;
  };

  const connections = getConnectedStars();

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      <svg className="w-full h-full">
        {/* Draw connections */}
        {connections.map((conn, i) => (
          <line
            key={i}
            x1={conn.from.x}
            y1={conn.from.y}
            x2={conn.to.x}
            y2={conn.to.y}
            stroke="rgba(255, 255, 255, 0.3)"
            strokeWidth="1"
            opacity={conn.opacity}
          />
        ))}
        
        {/* Draw stars */}
        {stars.map((star, i) => (
          <circle
            key={i}
            cx={star.x}
            cy={star.y}
            r={star.size}
            fill="white"
            opacity="0.6"
          />
        ))}
      </svg>
    </div>
  );
};

// Navigation Bar Component
const NavBar = ({ page, setPage, scrollY }) => {
  const isScrolled = scrollY > 50;

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-black/80 backdrop-blur-md border-b border-white/10' : 'bg-black border-b border-white/5'
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

// Main App Content Component
const AppContent = () => {
  const { isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const [page, setPage] = useState('home');
  const [result, setResult] = useState(null);
  const [synced, setSynced] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  const auth = { getToken };

  // Handle scroll
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Sync user with backend when signed in
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
        <AnimatedBackground />
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
          onStart={(difficulty, language) => setPage('quiz')}
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
    <div className="min-h-screen bg-black">
      {page !== 'quiz' && page !== 'result' && page !== 'config' && (
        <NavBar page={page} setPage={setPage} scrollY={scrollY} />
      )}
      <div className={page !== 'quiz' && page !== 'result' && page !== 'config' ? 'pt-20' : ''}>
        {renderPage()}
      </div>
    </div>
  );
};

// Root App with Clerk Provider
export default function App() {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <AppContent />
    </ClerkProvider>
  );
}