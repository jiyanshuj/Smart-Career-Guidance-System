import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Target, TrendingUp, Award, Code } from 'lucide-react';

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

const ProfilePage = ({ auth }) => {
  const { user } = useUser();
  const [profile, setProfile] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
    // Profile data is loaded once when the page mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <div className="flex min-h-screen items-center justify-center bg-transparent">
        <div className="h-12 w-12 animate-spin rounded-full border border-white/20 border-t-white"></div>
      </div>
    );
  }

  const improvementData = attempts.map((attempt, idx) => ({
    attempt: idx + 1,
    score: attempt.percentage,
  })).reverse();

  return (
    <div className="min-h-screen bg-transparent px-4 py-8 sm:py-10">
      <div className="max-w-6xl mx-auto">
        {/* Profile Header */}
        <div className="mb-6 rounded-[28px] border border-white/15 bg-black/50 p-6 text-white shadow-2xl backdrop-blur-md sm:p-8">
          <div className="flex items-center gap-6">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white text-2xl font-bold text-black shadow-lg shadow-white/10 sm:h-24 sm:w-24 sm:text-3xl">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div>
              <h1 className="mb-2 text-2xl font-semibold tracking-tight sm:text-3xl">{user?.fullName}</h1>
              <p className="text-white/55">{user?.primaryEmailAddress?.emailAddress}</p>
              {profile?.user?.degree && (
                <p className="mt-1 text-white/40">{profile.user.degree}</p>
              )}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: 'Total Attempts',
              value: profile?.stats?.total_attempts || 0,
              icon: Target,
              color: 'bg-white',
            },
            {
              label: 'Average Score',
              value: `${profile?.stats?.average_score || 0}%`,
              icon: TrendingUp,
              color: 'bg-white',
            },
            {
              label: 'Best Score',
              value: `${profile?.stats?.best_score || 0}/30`,
              icon: Award,
              color: 'bg-white',
            },
            {
              label: 'Latest Domain',
              value: profile?.stats?.latest_domain?.split(' ')[0] || 'N/A',
              icon: Code,
              color: 'bg-white',
            },
          ].map((stat, idx) => (
            <div key={idx} className="rounded-2xl border border-white/10 bg-black/45 p-5 shadow-lg backdrop-blur-md transition-all hover:-translate-y-1 hover:border-white/30 hover:bg-white/[0.06]">
              <div className={`${stat.color} mb-4 flex h-10 w-10 items-center justify-center rounded-xl shadow-lg shadow-white/10`}>
                <stat.icon className="h-5 w-5 text-black" />
              </div>
              <div className="mb-1 text-sm text-white/45">{stat.label}</div>
              <div className="text-2xl font-semibold text-white">{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Progress Chart */}
        {improvementData.length > 0 && (
          <div className="mb-6 rounded-2xl border border-white/10 bg-black/45 p-5 shadow-lg backdrop-blur-md sm:p-6">
            <h3 className="mb-4 text-xl font-semibold text-white">Your progress</h3>
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
        <div className="rounded-2xl border border-white/10 bg-black/45 p-5 shadow-lg backdrop-blur-md sm:p-6">
          <h3 className="mb-4 text-xl font-semibold text-white">Recent attempts</h3>
          <div className="space-y-4">
            {attempts.slice(0, 5).map((attempt) => (
              <div
                key={attempt.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-all hover:border-white/35 hover:bg-white/[0.07]"
              >
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <div className="font-semibold text-white">
                      Score: {attempt.total_score}/30 ({attempt.percentage}%)
                    </div>
                    <div className="text-sm text-white/40">
                      {new Date(attempt.completed_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-white">
                      {attempt.recommended_domain}
                    </div>
                    <div className="text-sm text-white/40">
                      {attempt.difficulty} • {attempt.language}
                    </div>
                  </div>
                </div>
                <div className="flex gap-4 text-sm">
                    <span className="text-white/60">
                    Programming: {attempt.domain_scores.programming.toFixed(1)}
                  </span>
                    <span className="text-white/60">
                    Analytics: {attempt.domain_scores.analytics.toFixed(1)}
                  </span>
                    <span className="text-white/60">
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