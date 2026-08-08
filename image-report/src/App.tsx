/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  TrendingUp, 
  Calendar, 
  Award, 
  User, 
  Plus, 
  Settings, 
  RefreshCw,
  ChevronRight,
  Flame,
  Activity,
  BarChart2,
  Image as ImageIcon,
  Crown,
  Search,
  Globe,
  Users
} from 'lucide-react';

interface FanRecord {
  date: string;
  fans: number;
  label: string;
}

interface LeaderboardTrainer {
  rank: number;
  name: string;
  trainerId: string;
  fans: number;
  activeDays: number;
  avatarUrl?: string;
  isCurrentUser?: boolean;
}

export default function App() {
  const [trainerName, setTrainerName] = useState(() => localStorage.getItem('trainer_name') || 'Koeru');
  const [trainerId, setTrainerId] = useState(() => localStorage.getItem('trainer_id') || '612856830731');
  const [globalRank, setGlobalRank] = useState(() => localStorage.getItem('global_rank') || '388');
  const [activeDays, setActiveDays] = useState(7);
  const [totalFans, setTotalFans] = useState(424950000);
  const [discordAvatarUrl, setDiscordAvatarUrl] = useState(() => localStorage.getItem('discord_avatar_url') || '');
  
  const [timeframe, setTimeframe] = useState<'today' | 'week' | 'month' | 'all'>('month');
  const [isAddingFans, setIsAddingFans] = useState(false);
  const [newFanInput, setNewFanInput] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedClub, setSelectedClub] = useState<'umakraft1' | 'umakraft2'>('umakraft1');
  const [leaderboardTab, setLeaderboardTab] = useState<'members' | 'ranking'>('members');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    localStorage.setItem('trainer_name', trainerName);
    localStorage.setItem('trainer_id', trainerId);
    localStorage.setItem('global_rank', globalRank);
    localStorage.setItem('discord_avatar_url', discordAvatarUrl);
  }, [trainerName, trainerId, globalRank, discordAvatarUrl]);

  // Growth data for Month-to-Date Fan Growth Chart
  const [growthData, setGrowthData] = useState<FanRecord[]>([
    { date: 'Aug 1', fans: 395000000, label: 'Aug 1' },
    { date: 'Aug 5', fans: 398000000, label: 'Aug 5' },
    { date: 'Aug 10', fans: 402000000, label: 'Aug 10' },
    { date: 'Aug 15', fans: 408000000, label: 'Aug 15' },
    { date: 'Aug 20', fans: 415000000, label: 'Aug 20' },
    { date: 'Aug 25', fans: 418000000, label: 'Aug 25' },
    { date: 'Aug 30', fans: 424950000, label: 'Aug 30' },
  ]);

  // Circle members data for UmaKraft 1 & UmaKraft 2
  const umakraft1Members: LeaderboardTrainer[] = [
    { rank: 1, name: trainerName, trainerId: trainerId, fans: totalFans, activeDays: activeDays, avatarUrl: discordAvatarUrl, isCurrentUser: true },
    { rank: 2, name: 'SilenceSuzukaFan', trainerId: '1029384756', fans: 390000000, activeDays: 31, avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80' },
    { rank: 3, name: 'TokaiTeio01', trainerId: '2048596713', fans: 350000000, activeDays: 30, avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80' },
    { rank: 4, name: 'SpecialWeek99', trainerId: '3059482716', fans: 310000000, activeDays: 29, avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80' },
    { rank: 5, name: 'GoldShipBest', trainerId: '4091827365', fans: 280000000, activeDays: 28, avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&auto=format&fit=crop&q=80' },
    { rank: 6, name: 'MejiroMacqueen', trainerId: '5019283746', fans: 245000000, activeDays: 27, avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&auto=format&fit=crop&q=80' },
  ];

  const umakraft2Members: LeaderboardTrainer[] = [
    { rank: 1, name: 'OguriCapLegend', trainerId: '7019283746', fans: 510000000, activeDays: 31, avatarUrl: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=100&auto=format&fit=crop&q=80' },
    { rank: 2, name: 'RiceShowerFan', trainerId: '6019283746', fans: 480000000, activeDays: 30, avatarUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100&auto=format&fit=crop&q=80' },
    { rank: 3, name: 'SymboliRudolf', trainerId: '8019283746', fans: 430000000, activeDays: 29, avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80' },
    { rank: 4, name: 'DaiwaScarlet', trainerId: '9019283746', fans: 395000000, activeDays: 28, avatarUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=100&auto=format&fit=crop&q=80' },
    { rank: 5, name: 'VodkaSpeed', trainerId: '1119283746', fans: 360000000, activeDays: 26, avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=100&auto=format&fit=crop&q=80' },
  ];

  const currentClubMembers = selectedClub === 'umakraft1' ? umakraft1Members : umakraft2Members;
  const clubName = selectedClub === 'umakraft1' ? 'UmaKraft 1 (#974470619)' : 'UmaKraft 2 (#325938032)';
  const clubUrl = selectedClub === 'umakraft1' ? 'https://uma.moe/circles/974470619' : 'https://uma.moe/circles/325938032';

  const formatFans = (num: number) => {
    if (num >= 1000000000) return (num / 1000000000).toFixed(2) + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  const handleAddFans = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(newFanInput);
    if (!isNaN(val) && val > 0) {
      const added = val * 1000000;
      const updatedTotal = totalFans + added;
      setTotalFans(updatedTotal);
      
      const updated = [...growthData];
      updated[updated.length - 1].fans = updatedTotal;
      setGrowthData(updated);
      setNewFanInput('');
      setIsAddingFans(false);
    }
  };

  // Chart dimensions & calculations
  const chartHeight = 220;
  const chartWidth = 720;
  const minFans = Math.min(...growthData.map(d => d.fans)) * 0.98;
  const maxFans = Math.max(...growthData.map(d => d.fans)) * 1.02;
  const fanRange = maxFans - minFans || 1;

  const points = growthData.map((d, i) => {
    const x = (i / (growthData.length - 1)) * (chartWidth - 60) + 40;
    const y = chartHeight - 40 - ((d.fans - minFans) / fanRange) * (chartHeight - 60);
    return { x, y, ...d };
  });

  const pathD = points.reduce((acc, p, idx) => {
    return idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${chartHeight - 30} L ${points[0].x} ${chartHeight - 30} Z`;

  // Sort and filter members for the selected club
  const filteredMembers = currentClubMembers
    .map((member, idx) => member.isCurrentUser ? { ...member, fans: totalFans, activeDays: activeDays, name: trainerName, trainerId: trainerId, avatarUrl: discordAvatarUrl } : member)
    .sort((a, b) => b.fans - a.fans)
    .map((m, idx) => ({ ...m, rank: idx + 1 }))
    .filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.trainerId.includes(searchQuery));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased pb-12 selection:bg-pink-500 selection:text-white">
      {/* Top Banner / Hero Header matching Umamusume aesthetic */}
      <header className="relative bg-gradient-to-r from-pink-400 via-rose-300 to-indigo-400 shadow-lg px-6 py-6 text-white overflow-hidden">
        <div className="absolute inset-0 bg-white/10 backdrop-blur-[2px] pointer-events-none"></div>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          
          {/* Trainer Profile Section */}
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-full bg-white text-pink-600 font-bold text-3xl flex items-center justify-center shadow-xl ring-4 ring-white/60 overflow-hidden">
              {discordAvatarUrl ? (
                <img 
                  src={discordAvatarUrl} 
                  alt="Discord Avatar" 
                  className="w-full h-full object-cover"
                  onError={() => setDiscordAvatarUrl('')}
                />
              ) : (
                trainerName.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-extrabold tracking-tight drop-shadow-sm">{trainerName}</h1>
                <button 
                  onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                  className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition text-white"
                  title="Trainer Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
              <p className="text-white/90 text-sm font-medium mt-0.5">Trainer ID: {trainerId}</p>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs font-semibold">
                <span className="px-2.5 py-1 rounded-full bg-white/25 backdrop-blur-md shadow-sm">
                  UmaKraft (#974470619)
                </span>
                <span className="px-2.5 py-1 rounded-full bg-indigo-900/30 backdrop-blur-md shadow-sm">
                  Global Rank #{globalRank}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-emerald-600/30 backdrop-blur-md shadow-sm flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {activeDays} days active this month
                </span>
              </div>
            </div>
          </div>

          {/* Total Fans Hero Badge */}
          <div className="bg-white/95 text-slate-800 backdrop-blur-xl px-8 py-4 rounded-2xl shadow-xl border border-white/50 flex flex-col items-end">
            <span className="text-xs uppercase tracking-wider font-bold text-slate-400">Total Fans</span>
            <div className="text-4xl font-black bg-gradient-to-r from-pink-600 to-indigo-600 bg-clip-text text-transparent">
              {formatFans(totalFans)}
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">

        {/* Settings Modal / Panel */}
        {isSettingsOpen && (
          <div className="bg-white rounded-2xl p-6 shadow-xl border border-slate-200 animate-fadeIn">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Settings className="w-5 h-5 text-pink-500" /> Trainer Profile & Discord Avatar Settings
              </h2>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Trainer Name</label>
                <input 
                  type="text" 
                  value={trainerName} 
                  onChange={(e) => setTrainerName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Trainer ID</label>
                <input 
                  type="text" 
                  value={trainerId} 
                  onChange={(e) => setTrainerId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Global Rank</label>
                <input 
                  type="text" 
                  value={globalRank} 
                  onChange={(e) => setGlobalRank(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Discord Avatar URL</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="https://cdn.discordapp.com/avatars/..." 
                    value={discordAvatarUrl} 
                    onChange={(e) => setDiscordAvatarUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm font-medium"
                  />
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-3">
              Tip: Right-click your Discord profile picture in Discord, select "Copy Link", and paste the image URL here.
            </p>
          </div>
        )}

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Today Card */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 hover:shadow-md transition flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
              <span>Today</span>
              <Activity className="w-4 h-4 text-pink-500" />
            </div>
            <div className="my-4">
              <div className="text-3xl font-black text-slate-900">+9.8M</div>
            </div>
            <div className="text-xs text-slate-500 font-medium">
              Rank <span className="font-bold text-slate-700">#17678</span> trainer
            </div>
          </div>

          {/* This Week Card */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 hover:shadow-md transition flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
              <span>This Week</span>
              <TrendingUp className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="my-4">
              <div className="text-3xl font-black text-slate-900">+27.0M</div>
            </div>
            <div className="text-xs text-slate-500 font-medium">
              Rank <span className="font-bold text-slate-700">#27357</span> trainer
            </div>
          </div>

          {/* This Month Card */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 hover:shadow-md transition flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
              <span>This Month</span>
              <Trophy className="w-4 h-4 text-amber-500" />
            </div>
            <div className="my-4">
              <div className="text-3xl font-black text-slate-900">+27.0M</div>
            </div>
            <div className="text-xs text-slate-500 font-medium">
              Rank <span className="font-bold text-slate-700">#388</span> trainer
            </div>
          </div>
        </div>

        {/* Lower Section: Chart & Tier Status Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Month-to-Date Fan Growth Chart (Span 2 cols) */}
          <div className="lg:col-span-2 bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 flex flex-col justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <BarChart2 className="w-5 h-5 text-pink-500" /> Month-to-Date Fan Growth
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Track your daily accumulation and milestones</p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-pink-600 bg-pink-50 px-3 py-1 rounded-xl">
                  +27.0M
                </span>
                <button
                  onClick={() => setIsAddingFans(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs font-bold shadow-md hover:opacity-95 transition"
                >
                  <Plus className="w-4 h-4" /> Log Fans
                </button>
              </div>
            </div>

            {/* Quick Fan Logging Modal */}
            {isAddingFans && (
              <form onSubmit={handleAddFans} className="mb-6 p-4 rounded-2xl bg-pink-50/70 border border-pink-100 flex items-center gap-3">
                <input 
                  type="number" 
                  step="0.1" 
                  placeholder="Enter fan gain in Millions (e.g., 2.5)" 
                  value={newFanInput}
                  onChange={(e) => setNewFanInput(e.target.value)}
                  className="flex-1 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-pink-500"
                  autoFocus
                />
                <button 
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-pink-600 text-white font-bold text-xs shadow hover:bg-pink-700 transition"
                >
                  Add
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsAddingFans(false)}
                  className="px-3 py-2 text-slate-500 text-xs font-bold hover:text-slate-700"
                >
                  Cancel
                </button>
              </form>
            )}

            {/* SVG Chart with Clean Font Rendering (No Box Font Issue) */}
            <div className="relative w-full overflow-x-auto">
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto min-w-[500px]">
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ec4899" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#ec4899" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                  const y = 20 + ratio * (chartHeight - 60);
                  const val = maxFans - ratio * fanRange;
                  return (
                    <g key={idx}>
                      <line 
                        x1="40" 
                        y1={y} 
                        x2={chartWidth - 20} 
                        y2={y} 
                        stroke="#f1f5f9" 
                        strokeWidth="1" 
                        strokeDasharray="4 4" 
                      />
                      <text 
                        x={chartWidth - 15} 
                        y={y - 4} 
                        fill="#94a3b8" 
                        fontSize="10" 
                        fontFamily="system-ui, -apple-system, sans-serif"
                        textAnchor="end"
                      >
                        {formatFans(val)}
                      </text>
                    </g>
                  );
                })}

                {/* Area fill */}
                <path d={areaD} fill="url(#chartGradient)" />

                {/* Main Curve Line */}
                <path d={pathD} fill="none" stroke="#ec4899" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                {/* Data Points and X-Axis Labels */}
                {points.map((p, idx) => (
                  <g key={idx}>
                    {/* Point Circle */}
                    <circle 
                      cx={p.x} 
                      cy={p.y} 
                      r="4.5" 
                      fill="#ffffff" 
                      stroke="#ec4899" 
                      strokeWidth="2.5" 
                    />
                    {/* X Axis Label */}
                    <text 
                      x={p.x} 
                      y={chartHeight - 10} 
                      fill="#64748b" 
                      fontSize="11" 
                      fontWeight="600"
                      fontFamily="system-ui, -apple-system, sans-serif"
                      textAnchor="middle"
                    >
                      {p.label}
                    </text>
                  </g>
                ))}
              </svg>
            </div>

            {/* Footer Tag */}
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-medium">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-pink-500"></span> UmaKraft · Fan Gain Sync Active
              </span>
              <span>Updated live</span>
            </div>
          </div>

          {/* Tier / Unranked Status Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">Unranked</h3>
                <span className="text-xs font-bold text-slate-400">Next: Minimum</span>
              </div>

              {/* Progress bar */}
              <div className="space-y-2 mb-6">
                <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden p-0.5">
                  <div 
                    className="bg-gradient-to-r from-pink-400 to-indigo-500 h-full rounded-full transition-all duration-500"
                    style={{ width: '45%' }}
                  ></div>
                </div>
                <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                  <span>27.0M / 60.0M</span>
                  <span className="text-pink-600">45%</span>
                </div>
              </div>

              {/* Stats List */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between text-sm py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-500" /> Daily Average
                  </span>
                  <span className="font-bold text-slate-900">3.9M/day</span>
                </div>

                <div className="flex items-center justify-between text-sm py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium flex items-center gap-2">
                    <Flame className="w-4 h-4 text-amber-500" /> Streak
                  </span>
                  <span className="font-bold text-slate-900">0 days active</span>
                </div>

                <div className="flex items-center justify-between text-sm py-2">
                  <span className="text-slate-500 font-medium flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-pink-500" /> To Minimum
                  </span>
                  <span className="font-bold text-pink-600">33.0M remaining</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 bg-slate-50/50 rounded-2xl p-4 text-xs text-slate-500 leading-relaxed">
              Keep training your Umamusumes daily in races and live events to boost your overall trainer ranking and unlock higher tier rewards!
            </div>
          </div>

        </div>

        {/* Circle Fan Leaderboard Section (Supporting 2 Clubs) */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
                <Crown className="w-6 h-6 text-amber-500" /> Circle Fan Leaderboard
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Switch between circles/clubs to view member fan rankings</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Club / Circle Switcher (2 Clubs supported) */}
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setSelectedClub('umakraft1')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    selectedClub === 'umakraft1' ? 'bg-white text-pink-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" /> UmaKraft 1
                </button>
                <button
                  onClick={() => setSelectedClub('umakraft2')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    selectedClub === 'umakraft2' ? 'bg-white text-pink-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" /> UmaKraft 2
                </button>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  placeholder="Search trainer..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-pink-500 w-48"
                />
              </div>
            </div>
          </div>

          <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-bold text-slate-500 px-1">
            <div className="flex items-center gap-2">
              <span>Active Circle: <span className="text-pink-600">{clubName}</span></span>
              <a 
                href={clubUrl} 
                target="_blank" 
                rel="noreferrer"
                className="text-indigo-600 hover:underline bg-indigo-50 px-2 py-0.5 rounded text-[11px]"
              >
                View on uma.moe ↗
              </a>
            </div>
            <span>{filteredMembers.length} Members</span>
          </div>

          {/* Leaderboard Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase font-bold text-slate-400">
                  <th className="py-3 px-4">Rank</th>
                  <th className="py-3 px-4">Trainer</th>
                  <th className="py-3 px-4">Trainer ID</th>
                  <th className="py-3 px-4">Active Days</th>
                  <th className="py-3 px-4 text-right">Total Fans</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredMembers.map((t) => (
                  <tr 
                    key={t.trainerId} 
                    className={`transition hover:bg-slate-50/80 ${t.isCurrentUser ? 'bg-pink-50/50 font-bold' : ''}`}
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        {t.rank === 1 && <span className="w-6 h-6 rounded-full bg-amber-400 text-white flex items-center justify-center text-xs font-black shadow">1</span>}
                        {t.rank === 2 && <span className="w-6 h-6 rounded-full bg-slate-300 text-slate-800 flex items-center justify-center text-xs font-black shadow">2</span>}
                        {t.rank === 3 && <span className="w-6 h-6 rounded-full bg-amber-700 text-white flex items-center justify-center text-xs font-black shadow">3</span>}
                        {t.rank > 3 && <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold">#{t.rank}</span>}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center font-bold text-pink-600">
                          {t.avatarUrl ? (
                            <img src={t.avatarUrl} alt={t.name} className="w-full h-full object-cover" />
                          ) : (
                            t.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <div className="text-slate-900 font-bold flex items-center gap-2">
                            {t.name}
                            {t.isCurrentUser && <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-100 text-pink-600 font-extrabold uppercase">You</span>}
                          </div>
                          <div className="text-xs text-slate-400 font-medium">{selectedClub === 'umakraft1' ? 'UmaKraft 1 Member' : 'UmaKraft 2 Member'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-xs font-mono text-slate-500">{t.trainerId}</td>
                    <td className="py-4 px-4 text-xs font-semibold text-slate-600">{t.activeDays} days</td>
                    <td className="py-4 px-4 text-right font-black text-slate-900">
                      <span className="bg-gradient-to-r from-pink-600 to-indigo-600 bg-clip-text text-transparent">
                        {formatFans(t.fans)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}

