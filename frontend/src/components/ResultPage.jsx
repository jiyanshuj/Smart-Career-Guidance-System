import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { Award, CheckCircle, TrendingUp, Target, BookOpen } from 'lucide-react';

const ResultPage = ({ result, onRetakeQuiz, onViewProfile }) => {
  const getGrade = (percentage) => {
    if (percentage >= 90) return { grade: 'A+', color: 'text-green-400' };
    if (percentage >= 80) return { grade: 'A', color: 'text-green-500' };
    if (percentage >= 70) return { grade: 'B', color: 'text-blue-400' };
    if (percentage >= 60) return { grade: 'C', color: 'text-yellow-400' };
    return { grade: 'D', color: 'text-red-400' };
  };

  const gradeInfo = getGrade(result.percentage);

  const radarData = [
    { domain: 'Programming', score: result.domain_scores.programming },
    { domain: 'Analytics', score: result.domain_scores.analytics },
    { domain: 'Testing', score: result.domain_scores.testing },
    { domain: 'Technical', score: result.domain_scores.technical || 0 },
  ];

  return (
    <div className="min-h-screen bg-black py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Your Results</h1>
          <p className="text-gray-400">Comprehensive analysis of your performance</p>
        </div>

        {/* Score Card */}
        <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-700 rounded-2xl shadow-2xl p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">Overall Score</h2>
              <p className="text-gray-400">
                {result.total_score} out of {result.total_questions} correct
              </p>
            </div>
            <div className="text-center">
              <div className={`text-6xl font-bold ${gradeInfo.color}`}>
                {gradeInfo.grade}
              </div>
              <div className="text-2xl font-semibold text-gray-300">
                {result.percentage}%
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-lg p-6 text-white">
            <div className="flex items-center gap-3 mb-2">
              <Award className="w-6 h-6 text-indigo-400" />
              <h3 className="text-xl font-semibold">Recommended Career Path</h3>
            </div>
            <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">{result.recommended_domain}</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Domain Scores */}
          <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-700 rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-white mb-4">Domain Scores</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={radarData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="domain" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }} />
                <Bar dataKey="score" fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Radar Chart */}
          <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-700 rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-white mb-4">Skills Profile</h3>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#374151" />
                <PolarAngleAxis dataKey="domain" stroke="#9CA3AF" />
                <PolarRadiusAxis stroke="#9CA3AF" />
                <Radar
                  name="Your Score"
                  dataKey="score"
                  stroke="#6366f1"
                  fill="#6366f1"
                  fillOpacity={0.6}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Insights */}
        {result.ai_insights && (
          <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-700 rounded-xl shadow-lg p-8 mb-6">
            <h3 className="text-2xl font-bold text-white mb-6">AI-Powered Insights</h3>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-green-400 mb-3 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Your Strengths
                </h4>
                <ul className="space-y-2">
                  {result.ai_insights.strengths?.map((strength, idx) => (
                    <li key={idx} className="text-gray-300 pl-4 border-l-2 border-green-500">
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-orange-400 mb-3 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Areas for Improvement
                </h4>
                <ul className="space-y-2">
                  {result.ai_insights.improvements?.map((improvement, idx) => (
                    <li key={idx} className="text-gray-300 pl-4 border-l-2 border-orange-500">
                      {improvement}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-blue-400 mb-3 flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Career Recommendations
                </h4>
                <ul className="space-y-2">
                  {result.ai_insights.career_paths?.map((path, idx) => (
                    <li key={idx} className="text-gray-300 pl-4 border-l-2 border-blue-500">
                      {path}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-purple-400 mb-3 flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  Learning Resources
                </h4>
                <ul className="space-y-2">
                  {result.ai_insights.learning_resources?.map((resource, idx) => (
                    <li key={idx} className="text-gray-300 pl-4 border-l-2 border-purple-500">
                      {resource}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4 justify-center">
          <button
            onClick={onRetakeQuiz}
            className="bg-gray-800 text-white px-8 py-3 rounded-lg font-semibold hover:bg-gray-700 transition-all border border-gray-700"
          >
            Retake Quiz
          </button>
          <button
            onClick={onViewProfile}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-3 rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-purple-500/50"
          >
            View Profile
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResultPage;