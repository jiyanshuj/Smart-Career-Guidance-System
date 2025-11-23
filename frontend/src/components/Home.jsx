import React, { useRef, useEffect, useState } from 'react';
import { SignInButton, useUser } from '@clerk/clerk-react';
import { Code, Brain, Target, BookOpen } from 'lucide-react';

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
    
    // Initialize stars only once
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

    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      // Update and draw stars
      starsRef.current.forEach((star) => {
        // Move stars
        star.x += star.vx;
        star.y += star.vy;

        // Wrap around screen edges
        if (star.x < 0) star.x = dimensions.width;
        if (star.x > dimensions.width) star.x = 0;
        if (star.y < 0) star.y = dimensions.height;
        if (star.y > dimensions.height) star.y = 0;

        // Twinkle effect
        star.opacity += star.twinkleSpeed;
        if (star.opacity > 0.8 || star.opacity < 0.2) {
          star.twinkleSpeed *= -1;
        }

        // Draw star
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
        ctx.fill();
      });

      // Draw connections between nearby stars
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
            ctx.strokeStyle = `rgba(59, 130, 246, ${opacity})`; // Blue color
            ctx.beginPath();
            ctx.moveTo(star1.x, star1.y);
            ctx.lineTo(star2.x, star2.y);
            ctx.stroke();
          }
        }
      }

      // Draw connections from mouse to nearby stars
      const mouseMaxDistance = 150;
      starsRef.current.forEach((star) => {
        const dx = mouseRef.current.x - star.x;
        const dy = mouseRef.current.y - star.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < mouseMaxDistance) {
          const opacity = (1 - distance / mouseMaxDistance) * 0.5;
          ctx.strokeStyle = `rgba(168, 85, 247, ${opacity})`; // Purple color
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(mouseRef.current.x, mouseRef.current.y);
          ctx.lineTo(star.x, star.y);
          ctx.stroke();

          // Add glow effect to connected stars
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

// Component for the Start Assessment button with auth logic
const StartAssessmentButton = ({ onStartQuiz }) => {
  const { isSignedIn } = useUser();

  if (isSignedIn) {
    // User is logged in, proceed to quiz
    return (
      <button
        onClick={onStartQuiz}
        className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-10 py-5 rounded-xl text-xl font-semibold hover:from-blue-600 hover:to-purple-700 transition-all transform hover:scale-105 shadow-2xl shadow-purple-500/50"
      >
        Start Your Assessment
      </button>
    );
  }

  // User is not logged in, show sign-in button
  return (
    <SignInButton mode="modal">
      <button className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-10 py-5 rounded-xl text-xl font-semibold hover:from-blue-600 hover:to-purple-700 transition-all transform hover:scale-105 shadow-2xl shadow-purple-500/50">
        Start Your Assessment
      </button>
    </SignInButton>
  );
};

const HomePage = ({ onStartQuiz }) => {
  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      <FloatingStarsBackground />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-20">
          <h1 className="text-7xl font-bold text-white mb-6 leading-tight">
            Discover Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">Career Path</span>
          </h1>
          <p className="text-2xl text-gray-300 mb-4 max-w-3xl mx-auto">
            AI-powered aptitude test to find your ideal tech career domain
          </p>
          <p className="text-lg text-gray-400 mb-10 max-w-2xl mx-auto">
            Take a comprehensive 30-question assessment across programming, analytics, testing, and technical domains to unlock personalized career insights
          </p>
          <StartAssessmentButton onStartQuiz={onStartQuiz} />
        </div>

        {/* Domain Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-20">
          {[
            { icon: Code, title: 'Programming', desc: 'Test coding skills & logic', color: 'bg-blue-500', gradient: 'from-blue-500 to-blue-700' },
            { icon: Brain, title: 'Analytics', desc: 'Evaluate analytical thinking', color: 'bg-green-500', gradient: 'from-green-500 to-green-700' },
            { icon: Target, title: 'Testing', desc: 'Assess QA capabilities', color: 'bg-yellow-500', gradient: 'from-yellow-500 to-yellow-700' },
            { icon: BookOpen, title: 'Technical', desc: 'Measure tech knowledge', color: 'bg-purple-500', gradient: 'from-purple-500 to-purple-700' },
          ].map((item, idx) => (
            <div key={idx} className="bg-white/5 backdrop-blur-lg rounded-xl p-6 hover:bg-white/10 transition-all transform hover:scale-105 border border-white/10">
              <div className={`bg-gradient-to-br ${item.gradient} w-14 h-14 rounded-xl flex items-center justify-center mb-4 shadow-lg`}>
                <item.icon className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-white font-semibold text-xl mb-2">{item.title}</h3>
              <p className="text-gray-400 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Features Section */}
        <div className="grid md:grid-cols-3 gap-8 mb-20">
          <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-8 border border-white/10">
            <div className="text-5xl mb-4">🎯</div>
            <h3 className="text-white font-bold text-2xl mb-3">Personalized Results</h3>
            <p className="text-gray-400">
              Get AI-powered insights tailored to your strengths, weaknesses, and career potential with detailed recommendations
            </p>
          </div>
          <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-8 border border-white/10">
            <div className="text-5xl mb-4">📊</div>
            <h3 className="text-white font-bold text-2xl mb-3">Comprehensive Analysis</h3>
            <p className="text-gray-400">
              Evaluate yourself across 6 key areas: Programming, OS, DBMS, Networks, Aptitude, and Verbal reasoning
            </p>
          </div>
          <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-8 border border-white/10">
            <div className="text-5xl mb-4">📈</div>
            <h3 className="text-white font-bold text-2xl mb-3">Track Progress</h3>
            <p className="text-gray-400">
              Monitor your improvement over time with detailed analytics and compare your performance across multiple attempts
            </p>
          </div>
        </div>

        {/* How It Works Section */}
        <div className="bg-gradient-to-r from-blue-500/10 to-purple-600/10 rounded-3xl p-12 border border-white/10 mb-20">
          <h2 className="text-4xl font-bold text-white text-center mb-12">How It Works</h2>
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { step: '1', title: 'Configure', desc: 'Choose difficulty and programming language' },
              { step: '2', title: 'Take Test', desc: '30 questions across multiple domains' },
              { step: '3', title: 'Get Results', desc: 'Receive AI-powered analysis instantly' },
              { step: '4', title: 'Improve', desc: 'Track progress and retake to improve' },
            ].map((item, idx) => (
              <div key={idx} className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4 shadow-lg shadow-purple-500/50">
                  {item.step}
                </div>
                <h4 className="text-white font-semibold text-lg mb-2">{item.title}</h4>
                <p className="text-gray-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Stats Section */}
        <div className="grid md:grid-cols-3 gap-8 text-center mb-20">
          <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-8 border border-white/10">
            <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600 mb-2">30+</div>
            <p className="text-gray-400 text-lg">Questions</p>
          </div>
          <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-8 border border-white/10">
            <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600 mb-2">6</div>
            <p className="text-gray-400 text-lg">Skill Domains</p>
          </div>
          <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-8 border border-white/10">
            <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600 mb-2">45</div>
            <p className="text-gray-400 text-lg">Minutes Test</p>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center bg-gradient-to-r from-blue-500/20 to-purple-600/20 rounded-3xl p-12 border border-white/20">
          <h2 className="text-4xl font-bold text-white mb-4">Ready to Find Your Path?</h2>
          <p className="text-xl text-gray-300 mb-8">
            Join thousands discovering their ideal tech career
          </p>
          <StartAssessmentButton onStartQuiz={onStartQuiz} />
        </div>
      </div>
    </div>
  );
};

export default HomePage;