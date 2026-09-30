import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle } from 'lucide-react';

const API_BASE = 'https://smart-career-guidance-system-kjrp.onrender.com/api';

const apiCall = async (endpoint, options = {}) => {
  const { getToken } = options.auth || {};
  const token = getToken ? await getToken() : null;

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
};

const QuizPage = ({ onComplete, auth, difficulty, language }) => {
  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(2700);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
    // The timer intentionally reads the latest submit handler through the quiz lifecycle.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz]);

  const generateQuiz = async (difficulty, language) => {
    try {
      setLoading(true);
      console.log('🔄 Generating quiz with:', { difficulty, language });

      const data = await apiCall('/quiz/generate', {
        method: 'POST',
        body: JSON.stringify({ difficulty, language }),
        auth,
      });

      console.log('✅ Quiz generated:', data);
      console.log('📊 Total questions:', data.total);
      console.log('🔑 Sample question IDs:', data.questions.slice(0, 3).map(q => q.id));

      setQuiz(data);
      setLoading(false);
    } catch (error) {
      console.error('❌ Failed to generate quiz:', error);
      alert(`Failed to generate quiz: ${error.message}`);
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => generateQuiz(difficulty, language));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficulty, language]);

  const handleAnswer = (questionId, answerIndex) => {
    console.log(`📝 Answer recorded: Q${questionId} = ${answerIndex}`);
    setAnswers({ ...answers, [questionId]: answerIndex });
  };

  const handleSubmit = async () => {
    if (!quiz || submitting) return;

    // Prevent double submission
    setSubmitting(true);

    console.log('\n📤 SUBMITTING QUIZ');
    console.log('Quiz ID:', quiz.quiz_id);
    console.log('Total answers:', Object.keys(answers).length);
    console.log('Sample answers:', Object.entries(answers).slice(0, 5));

    try {
      const result = await apiCall('/quiz/submit', {
        method: 'POST',
        body: JSON.stringify({
          quiz_id: quiz.quiz_id,
          answers: answers,
        }),
        auth,
      });

      console.log('✅ Quiz submitted successfully:', result);
      onComplete(result);
    } catch (error) {
      console.error('❌ Failed to submit quiz:', error);
      alert(`Failed to submit quiz: ${error.message}`);
      setSubmitting(false);
    }
  };

  if (loading || !quiz) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-transparent">
        <div className="text-white text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border border-white/20 border-t-white"></div>
          <p className="text-xl">Generating your personalized quiz...</p>
          <p className="text-sm text-gray-400 mt-2">This may take a few moments</p>
        </div>
      </div>
    );
  }

  const question = quiz.questions[currentQuestion];
  const progress = ((currentQuestion + 1) / quiz.total) * 100;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="min-h-screen bg-transparent">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-white/10 bg-black/70 shadow-2xl backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-white/60" />
              <span className={`font-semibold ${timeLeft < 300 ? 'text-red-400' : 'text-white'}`}>
                {minutes}:{seconds.toString().padStart(2, '0')}
              </span>
            </div>
            <div className="font-medium text-white/65">
              Question {currentQuestion + 1} of {quiz.total}
            </div>
            <div className="font-medium text-white/65">
              Answered: {Object.keys(answers).length}/{quiz.total}
            </div>
          </div>
          <div className="h-1.5 w-full rounded-full bg-white/10">
            <div
              className="h-1.5 rounded-full bg-white transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Question */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="rounded-[26px] border border-white/15 bg-black/50 p-5 shadow-2xl backdrop-blur-md sm:p-8">
          <div className="mb-6">
            <span className="mb-4 inline-block rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-sm font-semibold text-white/65">
              {question.category.toUpperCase()}
            </span>
            <h2 className="mb-4 text-2xl font-semibold tracking-tight text-white">
              {question.question}
            </h2>
          </div>

          <div className="space-y-3">
            {question.options.map((option, idx) => (
              <button
                key={idx}
                onClick={() => handleAnswer(question.id, idx)}
                className={`w-full rounded-2xl border p-4 text-left transition-all ${answers[question.id] === idx
                  ? 'border-white bg-white/[0.12] shadow-lg shadow-white/10'
                  : 'border-white/10 bg-white/[0.02] hover:border-white/40 hover:bg-white/[0.07]'
                  }`}
              >
                <div className="flex items-center">
                  <div
                    className={`mr-3 flex h-6 w-6 items-center justify-center rounded-full border-2 ${answers[question.id] === idx
                      ? 'border-white bg-white'
                      : 'border-white/30'
                      }`}
                  >
                    {answers[question.id] === idx && (
                      <CheckCircle className="h-4 w-4 text-black" />
                    )}
                  </div>
                  <span className="text-white">{option}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="flex justify-between mt-8">
            <button
              onClick={() => setCurrentQuestion((prev) => Math.max(0, prev - 1))}
              disabled={currentQuestion === 0}
              className="rounded-full border border-white/15 bg-white/[0.04] px-6 py-3 font-semibold text-white/70 transition-all hover:border-white/40 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>

            {currentQuestion === quiz.total - 1 ? (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="rounded-full bg-white px-6 py-3 font-semibold text-black transition-all hover:-translate-y-0.5 hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Quiz'}
              </button>
            ) : (
              <button
                onClick={() => setCurrentQuestion((prev) => Math.min(quiz.total - 1, prev + 1))}
                className="rounded-full bg-white px-6 py-3 font-semibold text-black transition-all hover:-translate-y-0.5 hover:bg-white/85"
              >
                Next
              </button>
            )}
          </div>
        </div>

        {/* Answer Grid */}
        <div className="mt-6 rounded-[26px] border border-white/15 bg-black/50 p-5 shadow-xl backdrop-blur-md sm:p-6">
          <h3 className="font-semibold text-white mb-4">Answer Overview</h3>
          <div className="grid grid-cols-10 gap-2">
            {quiz.questions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentQuestion(idx)}
                className={`h-10 w-10 rounded-xl font-semibold transition-all ${answers[q.id] !== undefined
                  ? 'bg-white text-black shadow-lg shadow-white/10'
                  : 'border border-white/10 bg-white/[0.04] text-white/45 hover:border-white/40 hover:text-white'
                  } ${currentQuestion === idx ? 'ring-2 ring-white ring-offset-2 ring-offset-black' : ''
                  }`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizPage;