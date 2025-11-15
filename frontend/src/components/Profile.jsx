import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Target, TrendingUp, Award, Code } from 'lucide-react';

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

const ProfilePage = ({ auth }) => {
  const { user } = useUser();
  const [profile, setProfile] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const [profileData, attemptsData] = await Promise.all([
        apiCall('/profile', { auth }),
        apiCall('/profile/attempts', { auth }),
      ]);
      setProfile(profileData);
      setAttempts(attemptsData.attempts);
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const improvementData = attempts.map((attempt, idx) => ({
    attempt: idx + 1,
    score: attempt.percentage,
  })).reverse();

  return (
    <div className="min-h-screen bg-black py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Profile Header */}
        <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-700 rounded-2xl shadow-2xl p-8 mb-6 text-white">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-purple-500/50">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div>
              <h1 className="text-3xl font-bold mb-2">{user?.fullName}</h1>
              <p className="text-gray-300">{user?.primaryEmailAddress?.emailAddress}</p>
              {profile?.user?.degree && (
                <p className="text-gray-400 mt-1">{profile.user.degree}</p>
              )}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-6">
          {[
            {
              label: 'Total Attempts',
              value: profile?.stats?.total_attempts || 0,
              icon: Target,
              color: 'from-blue-500 to-blue-700',
            },
            {
              label: 'Average Score',
              value: `${profile?.stats?.average_score || 0}%`,
              icon: TrendingUp,
              color: 'from-green-500 to-green-700',
            },
            {
              label: 'Best Score',
              value: `${profile?.stats?.best_score || 0}/30`,
              icon: Award,
              color: 'from-yellow-500 to-yellow-700',
            },
            {
              label: 'Latest Domain',
              value: profile?.stats?.latest_domain?.split(' ')[0] || 'N/A',
              icon: Code,
              color: 'from-purple-500 to-purple-700',
            },
          ].map((stat, idx) => (
            <div key={idx} className="bg-gray-900/80 backdrop-blur-xl border border-gray-700 rounded-xl shadow-lg p-6 hover:shadow-2xl hover:border-gray-600 transition-all">
              <div className={`bg-gradient-to-br ${stat.color} w-12 h-12 rounded-lg flex items-center justify-center mb-4 shadow-lg`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <div className="text-gray-400 text-sm mb-1">{stat.label}</div>
              <div className="text-2xl font-bold text-white">{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Progress Chart */}
        {improvementData.length > 0 && (
          <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-700 rounded-xl shadow-lg p-6 mb-6">
            <h3 className="text-xl font-bold text-white mb-4">Your Progress</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={improvementData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="attempt" stroke="#9CA3AF" label={{ value: 'Attempt', position: 'insideBottom', offset: -5, fill: '#9CA3AF' }} />
                <YAxis stroke="#9CA3AF" label={{ value: 'Score %', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }} />
                <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }} />
                <Legend />
                <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Recent Attempts */}
        <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-700 rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-white mb-4">Recent Attempts</h3>
          <div className="space-y-4">
            {attempts.slice(0, 5).map((attempt) => (
              <div
                key={attempt.id}
                className="bg-gray-800/60 backdrop-blur-sm border-2 border-gray-700 rounded-lg p-4 hover:border-indigo-500/50 hover:bg-gray-800/80 transition-all"
              >
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <div className="font-semibold text-white">
                      Score: {attempt.total_score}/30 ({attempt.percentage}%)
                    </div>
                    <div className="text-sm text-gray-400">
                      {new Date(attempt.completed_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-indigo-400">
                      {attempt.recommended_domain}
                    </div>
                    <div className="text-sm text-gray-400">
                      {attempt.difficulty} • {attempt.language}
                    </div>
                  </div>
                </div>
                <div className="flex gap-4 text-sm">
                  <span className="text-blue-400">
                    Programming: {attempt.domain_scores.programming.toFixed(1)}
                  </span>
                  <span className="text-green-400">
                    Analytics: {attempt.domain_scores.analytics.toFixed(1)}
                  </span>
                  <span className="text-yellow-400">
                    Testing: {attempt.domain_scores.testing.toFixed(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;