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
    <div className="flex min-h-screen items-center justify-center bg-transparent px-4 py-10">
      <div className="w-full max-w-2xl rounded-[28px] border border-white/15 bg-black/55 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-md sm:p-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Career assessment</p>
        <h2 className="mb-6 text-3xl font-semibold tracking-tight text-white">Configure your test</h2>
        
        <div className="mb-6">
          <label className="mb-3 block text-sm font-medium text-white/75">Difficulty level</label>
          <div className="grid grid-cols-3 gap-4">
            {difficulties.map((diff) => (
              <button
                key={diff.value}
                onClick={() => setDifficulty(diff.value)}
                className={`rounded-2xl border p-4 text-left transition-all ${
                  difficulty === diff.value
                    ? 'border-white bg-white text-black shadow-lg shadow-white/10'
                    : 'border-white/15 bg-white/[0.03] hover:border-white/45 hover:bg-white/[0.08]'
                }`}
              >
                <div className={`font-semibold ${difficulty === diff.value ? 'text-black' : 'text-white'}`}>{diff.label}</div>
                <div className={`text-sm ${difficulty === diff.value ? 'text-black/60' : 'text-white/45'}`}>{diff.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-8">
          <label className="mb-3 block text-sm font-medium text-white/75">Programming language</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-white/[0.05] p-3 text-white outline-none transition focus:border-white/60 focus:bg-white/[0.08]"
          >
            {languages.map((lang) => (
              <option key={lang} value={lang.toLowerCase()} className="bg-black">
                {lang}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <h3 className="mb-2 font-semibold text-white">Test details</h3>
          <ul className="space-y-1 text-sm text-white/55">
            <li>• 30 questions total</li>
            <li>• 5 questions each: OS, DBMS, Networks, Aptitude, Verbal</li>
            <li>• 5 programming questions in {language}</li>
            <li>• Estimated time: 45 minutes</li>
          </ul>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={onBack}
            className="flex-1 rounded-full border border-white/15 bg-white/[0.04] py-3 font-semibold text-white/70 transition-all hover:border-white/40 hover:bg-white/[0.08] hover:text-white"
          >
            Back
          </button>
          <button
            onClick={() => onStart(difficulty, language)}
            className="flex-1 rounded-full bg-white py-3 font-semibold text-black transition-all hover:-translate-y-0.5 hover:bg-white/85"
          >
            Start Quiz
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuizConfig;