import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle } from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

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
  }, [answers, quiz]);

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
    generateQuiz(difficulty, language);
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
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
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
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="bg-gray-900/80 backdrop-blur-xl border-b border-gray-700 shadow-2xl sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-400" />
              <span className={`font-semibold ${timeLeft < 300 ? 'text-red-400' : 'text-white'}`}>
                {minutes}:{seconds.toString().padStart(2, '0')}
              </span>
            </div>
            <div className="text-gray-300 font-medium">
              Question {currentQuestion + 1} of {quiz.total}
            </div>
            <div className="text-green-400 font-medium">
              Answered: {Object.keys(answers).length}/{quiz.total}
            </div>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-indigo-500 to-purple-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Question */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-700 rounded-xl shadow-lg p-8">
          <div className="mb-6">
            <span className="inline-block bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full text-sm font-semibold mb-4 border border-indigo-500/30">
              {question.category.toUpperCase()}
            </span>
            <h2 className="text-2xl font-bold text-white mb-4">
              {question.question}
            </h2>
          </div>

          <div className="space-y-3">
            {question.options.map((option, idx) => (
              <button
                key={idx}
                onClick={() => handleAnswer(question.id, idx)}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${answers[question.id] === idx
                    ? 'border-indigo-500 bg-indigo-500/20 shadow-lg shadow-indigo-500/20'
                    : 'border-gray-700 hover:border-indigo-500/50 hover:bg-gray-800/50'
                  }`}
              >
                <div className="flex items-center">
                  <div
                    className={`w-6 h-6 rounded-full border-2 mr-3 flex items-center justify-center ${answers[question.id] === idx
                        ? 'border-indigo-500 bg-indigo-500'
                        : 'border-gray-600'
                      }`}
                  >
                    {answers[question.id] === idx && (
                      <CheckCircle className="w-4 h-4 text-white" />
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
              className="px-6 py-3 bg-gray-800 text-gray-300 rounded-lg font-semibold hover:bg-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-gray-700"
            >
              Previous
            </button>

            {currentQuestion === quiz.total - 1 ? (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-semibold hover:from-green-700 hover:to-green-800 transition-all shadow-lg shadow-green-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting...' : 'Submit Quiz'}
              </button>
            ) : (
              <button
                onClick={() => setCurrentQuestion((prev) => Math.min(quiz.total - 1, prev + 1))}
                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-purple-500/50"
              >
                Next
              </button>
            )}
          </div>
        </div>

        {/* Answer Grid */}
        <div className="mt-6 bg-gray-900/80 backdrop-blur-xl border border-gray-700 rounded-xl shadow-lg p-6">
          <h3 className="font-semibold text-white mb-4">Answer Overview</h3>
          <div className="grid grid-cols-10 gap-2">
            {quiz.questions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentQuestion(idx)}
                className={`w-10 h-10 rounded-lg font-semibold transition-all ${answers[q.id] !== undefined
                    ? 'bg-green-500 text-white shadow-lg shadow-green-500/50'
                    : 'bg-gray-800 text-gray-400 border border-gray-700'
                  } ${currentQuestion === idx ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-black' : ''
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