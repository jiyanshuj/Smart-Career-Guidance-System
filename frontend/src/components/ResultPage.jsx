import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, PieChart, Pie, Cell } from 'recharts';
import { Award, CheckCircle, TrendingUp, Target, BookOpen, XCircle, Share2, Download, ChevronDown, ChevronUp, Calendar, Trophy, MapPin } from 'lucide-react';

const ResultPage = ({ result, onRetakeQuiz, onViewProfile }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [showQuestionDetails, setShowQuestionDetails] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');

  const getGrade = (percentage) => {
    if (percentage >= 90) return { grade: 'A+', color: 'text-green-400', bgColor: 'bg-green-500/20' };
    if (percentage >= 80) return { grade: 'A', color: 'text-green-500', bgColor: 'bg-green-500/20' };
    if (percentage >= 70) return { grade: 'B', color: 'text-blue-400', bgColor: 'bg-blue-500/20' };
    if (percentage >= 60) return { grade: 'C', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' };
    return { grade: 'D', color: 'text-red-400', bgColor: 'bg-red-500/20' };
  };

  const gradeInfo = getGrade(result.percentage);

  const radarData = [
    { domain: 'Programming', score: result.domain_scores.programming || 0 },
    { domain: 'Analytics', score: result.domain_scores.analytics || 0 },
    { domain: 'Testing', score: result.domain_scores.testing || 0 },
    { domain: 'Technical', score: result.domain_scores.technical || 0 },
  ];

  // Prepare category breakdown for pie chart
  const categoryData = result.category_breakdown ? Object.keys(result.category_breakdown).map(cat => ({
    name: cat.toUpperCase(),
    value: result.category_breakdown[cat].correct,
    total: result.category_breakdown[cat].total,
    percentage: Math.round((result.category_breakdown[cat].correct / result.category_breakdown[cat].total) * 100)
  })) : [];

  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/shared-results/${result.result_id}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My Quiz Results',
          text: `I scored ${result.percentage}% on the career assessment quiz!`,
          url: shareUrl,
        });
      } catch (err) {
        console.log('Share failed:', err);
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(shareUrl);
      alert('Share link copied to clipboard!');
    }
  };

  const handleDownload = () => {
    // Generate PDF or image (simplified version)
    alert('Download feature coming soon!');
  };

  // Filter questions by category
  const filteredQuestions = selectedCategory === 'all' 
    ? result.question_results || []
    : (result.question_results || []).filter(q => q.category === selectedCategory);

  const correctCount = filteredQuestions.filter(q => q.is_correct).length;
  const incorrectCount = filteredQuestions.length - correctCount;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-green-500/20 text-green-400 px-4 py-2 rounded-full mb-4 border border-green-500/30">
            <Trophy className="w-5 h-5" />
            <span className="font-semibold">Assessment Complete</span>
          </div>
          <h1 className="text-5xl font-bold text-white mb-2">Your Results</h1>
          <p className="text-gray-400">Comprehensive analysis of your performance</p>
        </div>

        {/* Score Overview Card */}
        <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-700 rounded-2xl shadow-2xl p-8 mb-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex-1">
              <h2 className="text-3xl font-bold text-white mb-2">Overall Performance</h2>
              <p className="text-gray-400 text-lg mb-4">
                {result.total_score} out of {result.total_questions} questions correct
              </p>
              
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <span className="text-green-400 font-semibold">Correct</span>
                  </div>
                  <div className="text-3xl font-bold text-white">{result.total_score}</div>
                </div>
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <XCircle className="w-5 h-5 text-red-400" />
                    <span className="text-red-400 font-semibold">Incorrect</span>
                  </div>
                  <div className="text-3xl font-bold text-white">
                    {result.total_questions - result.total_score}
                  </div>
                </div>
              </div>
            </div>

            {/* Grade Display */}
            <div className="text-center">
              <div className={`w-40 h-40 rounded-full ${gradeInfo.bgColor} border-4 border-gray-700 flex flex-col items-center justify-center`}>
                <div className={`text-6xl font-bold ${gradeInfo.color}`}>
                  {gradeInfo.grade}
                </div>
                <div className="text-2xl font-semibold text-gray-300 mt-2">
                  {result.percentage}%
                </div>
              </div>
            </div>

            {/* Recommended Domain */}
            <div className="flex-1">
              <div className="bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Award className="w-6 h-6 text-indigo-400" />
                  <h3 className="text-lg font-semibold text-white">Recommended Path</h3>
                </div>
                <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
                  {result.recommended_domain}
                </p>
                <p className="text-gray-400 text-sm mt-2">Based on your strengths and performance</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-center mt-8 pt-6 border-t border-gray-700">
            <button
              onClick={handleShare}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-all"
            >
              <Share2 className="w-5 h-5" />
              Share Results
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 bg-gray-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-600 transition-all"
            >
              <Download className="w-5 h-5" />
              Download PDF
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-700 rounded-xl mb-6 p-2 flex gap-2 overflow-x-auto">
          {['overview', 'career_path', 'action_plan', 'resources', 'questions'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 rounded-lg font-semibold transition-all whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {tab.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Charts Grid */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Domain Scores Bar Chart */}
              <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-700 rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-white mb-4">Domain Scores</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={radarData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="domain" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1F2937', 
                        border: '1px solid #374151', 
                        borderRadius: '8px' 
                      }} 
                    />
                    <Bar dataKey="score" fill="#6366f1" radius={[8, 8, 0, 0]} />
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

              {/* Category Breakdown Pie Chart */}
              {categoryData.length > 0 && (
                <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-700 rounded-xl shadow-lg p-6">
                  <h3 className="text-xl font-bold text-white mb-4">Category Performance</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percentage }) => `${name}: ${percentage}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Performance Summary */}
              <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-700 rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-white mb-4">Performance Summary</h3>
                {result.ai_insights?.overview && (
                  <div className="space-y-4">
                    <p className="text-gray-300 leading-relaxed">
                      {result.ai_insights.overview.summary}
                    </p>
                    <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-4">
                      <p className="text-indigo-300 font-semibold">
                        💡 Key Takeaway: {result.ai_insights.overview.key_takeaway}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Strengths & Improvements */}
            {result.ai_insights && (
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-700 rounded-xl shadow-lg p-6">
                  <h4 className="font-semibold text-green-400 mb-4 flex items-center gap-2 text-lg">
                    <CheckCircle className="w-6 h-6" />
                    Your Strengths
                  </h4>
                  <ul className="space-y-3">
                    {result.ai_insights.strengths?.map((strength, idx) => (
                      <li key={idx} className="text-gray-300 pl-4 border-l-2 border-green-500 py-2">
                        {strength}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-700 rounded-xl shadow-lg p-6">
                  <h4 className="font-semibold text-orange-400 mb-4 flex items-center gap-2 text-lg">
                    <TrendingUp className="w-6 h-6" />
                    Areas for Improvement
                  </h4>
                  <ul className="space-y-3">
                    {result.ai_insights.improvements?.map((improvement, idx) => (
                      <li key={idx} className="text-gray-300 pl-4 border-l-2 border-orange-500 py-2">
                        {improvement}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'career_path' && result.ai_insights?.career_paths && (
          <div className="space-y-6">
            <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-700 rounded-xl shadow-lg p-6">
              <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <MapPin className="w-6 h-6 text-blue-400" />
                Career Recommendations
              </h3>
              <div className="grid md:grid-cols-3 gap-6">
                {result.ai_insights.career_paths.map((path, idx) => (
                  <div 
                    key={idx} 
                    className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-6 hover:border-indigo-500/50 transition-all"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-8 h-8 rounded-full ${
                        idx === 0 ? 'bg-indigo-500' : idx === 1 ? 'bg-purple-500' : 'bg-pink-500'
                      } flex items-center justify-center text-white font-bold`}>
                        {idx + 1}
                      </div>
                      <h4 className="text-xl font-bold text-white">{path.title}</h4>
                    </div>
                    <p className="text-gray-300 mb-4">{path.description}</p>
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                      <p className="text-blue-300 text-sm font-semibold">📈 {path.growth}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'action_plan' && result.ai_insights?.action_plan && (
          <div className="space-y-6">
            <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-700 rounded-xl shadow-lg p-6">
              <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <Calendar className="w-6 h-6 text-purple-400" />
                Your Action Plan
              </h3>
              <div className="space-y-6">
                {result.ai_insights.action_plan.map((plan, idx) => (
                  <div key={idx} className="border-l-4 border-purple-500 pl-6 py-2">
                    <h4 className="text-xl font-bold text-purple-400 mb-3">{plan.phase}</h4>
                    <ul className="space-y-2">
                      {plan.actions.map((action, actionIdx) => (
                        <li key={actionIdx} className="flex items-start gap-3 text-gray-300">
                          <span className="text-purple-400 mt-1">✓</span>
                          <span>{action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'resources' && result.ai_insights?.learning_resources && (
          <div className="space-y-6">
            <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-700 rounded-xl shadow-lg p-6">
              <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-green-400" />
                Learning Resources
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                {result.ai_insights.learning_resources.map((resource, idx) => (
                  <div 
                    key={idx} 
                    className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-6 hover:border-green-500/50 transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm font-semibold">
                        {resource.type}
                      </span>
                    </div>
                    <h4 className="text-xl font-bold text-white mb-2">{resource.title}</h4>
                    <p className="text-gray-400 text-sm mb-3">{resource.platform}</p>
                    <p className="text-gray-300">{resource.focus}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'questions' && result.question_results && (
          <div className="space-y-6">
            <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-700 rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                  Question-by-Question Analysis
                </h3>
                <button
                  onClick={() => setShowQuestionDetails(!showQuestionDetails)}
                  className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  {showQuestionDetails ? (
                    <>
                      <ChevronUp className="w-5 h-5" />
                      Hide Details
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-5 h-5" />
                      Show Details
                    </>
                  )}
                </button>
              </div>

              {/* Category Filter */}
              <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all ${
                    selectedCategory === 'all'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  All ({result.question_results.length})
                </button>
                {categoryData.map((cat) => (
                  <button
                    key={cat.name}
                    onClick={() => setSelectedCategory(cat.name.toLowerCase())}
                    className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all ${
                      selectedCategory === cat.name.toLowerCase()
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {cat.name} ({cat.value}/{cat.total})
                  </button>
                ))}
              </div>

              {/* Stats Summary */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <span className="text-green-400 font-semibold">Correct</span>
                  </div>
                  <div className="text-2xl font-bold text-white">{correctCount}</div>
                </div>
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <XCircle className="w-5 h-5 text-red-400" />
                    <span className="text-red-400 font-semibold">Incorrect</span>
                  </div>
                  <div className="text-2xl font-bold text-white">{incorrectCount}</div>
                </div>
              </div>

              {/* Question List */}
              {showQuestionDetails && (
                <div className="space-y-4">
                  {filteredQuestions.map((q, idx) => (
                    <div
                      key={q.id}
                      className={`border-l-4 ${
                        q.is_correct ? 'border-green-500 bg-green-500/5' : 'border-red-500 bg-red-500/5'
                      } rounded-r-lg p-5`}
                    >
                      <div className="flex items-start gap-3 mb-3">
                        {q.is_correct ? (
                          <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
                        ) : (
                          <XCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-gray-500 font-semibold">Q{idx + 1}</span>
                            <span className="bg-gray-700 text-gray-300 px-2 py-1 rounded text-xs uppercase">
                              {q.category}
                            </span>
                          </div>
                          <h4 className="text-lg font-semibold text-white mb-3">{q.question}</h4>
                          
                          <div className="space-y-2">
                            {q.options.map((option, optIdx) => {
                              const isCorrect = optIdx === q.correct_answer;
                              const isUserAnswer = optIdx === q.user_answer;
                              
                              return (
                                <div
                                  key={optIdx}
                                  className={`p-3 rounded-lg border ${
                                    isCorrect
                                      ? 'border-green-500 bg-green-500/10'
                                      : isUserAnswer
                                      ? 'border-red-500 bg-red-500/10'
                                      : 'border-gray-700 bg-gray-800/50'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className={`font-semibold ${
                                      isCorrect ? 'text-green-400' : isUserAnswer ? 'text-red-400' : 'text-gray-400'
                                    }`}>
                                      {String.fromCharCode(65 + optIdx)}.
                                    </span>
                                    <span className={
                                      isCorrect ? 'text-green-300' : isUserAnswer ? 'text-red-300' : 'text-gray-300'
                                    }>
                                      {option}
                                    </span>
                                    {isCorrect && (
                                      <span className="ml-auto text-green-400 text-sm font-semibold">✓ Correct</span>
                                    )}
                                    {isUserAnswer && !isCorrect && (
                                      <span className="ml-auto text-red-400 text-sm font-semibold">✗ Your Answer</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {q.explanation && (
                            <div className="mt-3 bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                              <p className="text-blue-300 text-sm">
                                <span className="font-semibold">Explanation:</span> {q.explanation}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex gap-4 justify-center mt-8">
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