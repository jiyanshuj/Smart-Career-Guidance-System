import React from 'react';
import { Code, Brain, Target, BookOpen } from 'lucide-react';

const AnimatedBackground = () => {
  const [stars, setStars] = React.useState([]);
  const [mouse, setMouse] = React.useState({ x: 0, y: 0 });

  React.useEffect(() => {
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

    stars.forEach((star) => {
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

const HomePage = ({ onStartQuiz }) => {
  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      <AnimatedBackground />
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
          <button
            onClick={onStartQuiz}
            className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-10 py-5 rounded-xl text-xl font-semibold hover:from-blue-600 hover:to-purple-700 transition-all transform hover:scale-105 shadow-2xl shadow-purple-500/50"
          >
            Start Your Assessment
          </button>
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
          <button
            onClick={onStartQuiz}
            className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-10 py-5 rounded-xl text-xl font-semibold hover:from-blue-600 hover:to-purple-700 transition-all transform hover:scale-105 shadow-2xl shadow-purple-500/50"
          >
            Begin Your Journey
          </button>
        </div>
      </div>
    </div>
  );
};

export default HomePage;