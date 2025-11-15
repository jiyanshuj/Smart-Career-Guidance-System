import React, { useState } from 'react';

const QuizConfig = ({ onStart, onBack }) => {
  const [difficulty, setDifficulty] = useState('moderate');
  const [language, setLanguage] = useState('python');

  const difficulties = [
    { value: 'easy', label: 'Easy', desc: 'Beginner level' },
    { value: 'moderate', label: 'Moderate', desc: 'Intermediate level' },
    { value: 'hard', label: 'Hard', desc: 'Advanced level' },
  ];

  const languages = [
    'Python', 'Java', 'JavaScript', 'C++', 'C#', 'Go', 'Ruby', 'PHP'
  ];

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-700 rounded-2xl shadow-2xl p-8 max-w-2xl w-full">
        <h2 className="text-3xl font-bold text-white mb-6">Configure Your Test</h2>
        
        <div className="mb-6">
          <label className="block text-gray-200 font-semibold mb-3">Difficulty Level</label>
          <div className="grid grid-cols-3 gap-4">
            {difficulties.map((diff) => (
              <button
                key={diff.value}
                onClick={() => setDifficulty(diff.value)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  difficulty === diff.value
                    ? 'border-indigo-500 bg-indigo-500/20 shadow-lg shadow-indigo-500/50'
                    : 'border-gray-700 hover:border-indigo-500/50 hover:bg-gray-800/50'
                }`}
              >
                <div className="font-semibold text-white">{diff.label}</div>
                <div className="text-sm text-gray-400">{diff.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-8">
          <label className="block text-gray-200 font-semibold mb-3">Programming Language</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full p-3 bg-gray-800/80 backdrop-blur-sm border-2 border-gray-700 rounded-lg focus:border-indigo-500 focus:outline-none text-white"
          >
            {languages.map((lang) => (
              <option key={lang} value={lang.toLowerCase()} className="bg-gray-800">
                {lang}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-indigo-300 mb-2">Test Details:</h3>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>• 30 questions total</li>
            <li>• 5 questions each: OS, DBMS, Networks, Aptitude, Verbal</li>
            <li>• 5 programming questions in {language}</li>
            <li>• Estimated time: 45 minutes</li>
          </ul>
        </div>

        <div className="flex gap-4">
          <button
            onClick={onBack}
            className="flex-1 bg-gray-800 text-gray-300 py-3 rounded-lg font-semibold hover:bg-gray-700 transition-all border border-gray-700"
          >
            Back
          </button>
          <button
            onClick={() => onStart(difficulty, language)}
            className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-purple-500/50"
          >
            Start Quiz
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuizConfig;