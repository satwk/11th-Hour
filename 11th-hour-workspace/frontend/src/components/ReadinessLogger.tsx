import React, { useState, useEffect } from 'react';

interface ReadinessLoggerProps {
  onReplan: (stats: { energyLevel: number; sleepHours: number; dailyWinsCount: number }) => void;
  currentScore: number | null;
  loading: boolean;
  onStatsChange?: (stats: { energyLevel: number; sleepHours: number; dailyWinsCount: number }) => void;
}

export const ReadinessLogger: React.FC<ReadinessLoggerProps> = ({ 
  onReplan, 
  currentScore, 
  loading,
  onStatsChange 
}) => {
  const [energyLevel, setEnergyLevel] = useState<number>(3);
  const [sleepHours, setSleepHours] = useState<number>(7);
  const [dailyWinsCount, setDailyWinsCount] = useState<number>(2);

  // Notify parent of updates to adjust the ambient focus potential glow
  useEffect(() => {
    if (onStatsChange) {
      onStatsChange({ energyLevel, sleepHours, dailyWinsCount });
    }
  }, [energyLevel, sleepHours, dailyWinsCount]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onReplan({ energyLevel, sleepHours, dailyWinsCount });
  };

  const liveScore = Math.round(
    (energyLevel / 5) * 50 +
    Math.min(sleepHours / 8, 1) * 40 +
    Math.min(dailyWinsCount / 5, 1) * 10
  );

  return (
    <div className="bg-[#0f1011] border border-[#222326] rounded-lg p-6 shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium text-[#f7f8f8]">Daily Readiness</h2>
        <span className={`text-[10px] uppercase font-semibold font-mono tracking-wider px-2 py-0.5 rounded border transition-colors ${
          liveScore < 50
            ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
            : liveScore >= 75
            ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
            : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
        }`}>
          {liveScore < 50 ? 'Exhausted' : liveScore >= 75 ? 'Ready & Focused' : 'Balanced & Alert'}
        </span>
      </div>

      {currentScore !== null && (
        <div className="mb-6 flex items-center justify-between bg-[#141516] border border-[#222326] p-4 rounded-md animate-fade-in">
          <div>
            <span className="text-xs text-[#8a8f98] block uppercase tracking-wider">Readiness Score</span>
            <span className="text-3xl font-semibold text-[#f7f8f8] font-mono">{currentScore}/100</span>
          </div>
          <div className="text-right">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
              currentScore < 60 
                ? 'bg-red-500/10 text-red-400 border-red-500/20' 
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            }`}>
              {currentScore < 60 ? 'Replan Required' : 'Ready & Focused'}
            </span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <div className="flex justify-between text-sm font-medium text-[#d0d6e0] mb-1.5">
            <span>Energy Level:</span>
            <span className="font-semibold font-mono text-[#5e6ad2]">{energyLevel} / 5</span>
          </div>
          <input
            type="range"
            min="1"
            max="5"
            value={energyLevel}
            onChange={(e) => setEnergyLevel(parseInt(e.target.value))}
            className="w-full h-1 bg-[#222326] rounded-lg appearance-none cursor-pointer accent-[#5e6ad2]"
          />
          <div className="flex justify-between text-[10px] text-[#8a8f98] px-0.5 mt-1 font-mono">
            <span>Exhausted</span>
            <span>Unstoppable</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#d0d6e0] mb-1.5">
            Sleep Hours
          </label>
          <input
            type="number"
            min="0"
            max="24"
            step="0.5"
            value={sleepHours}
            onChange={(e) => setSleepHours(parseFloat(e.target.value))}
            className="w-full bg-[#141516] text-[#f7f8f8] border border-[#222326] rounded-md p-2.5 text-sm font-mono focus:outline-none focus:border-[#34343a] focus:ring-1 focus:ring-[#5e6ad2] transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#d0d6e0] mb-1.5">
            Daily Wins Yesterday
          </label>
          <div className="flex space-x-1.5">
            {[0, 1, 2, 3, 4, 5].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setDailyWinsCount(val)}
                className={`flex-1 py-1.5 rounded border text-xs font-semibold font-mono transition-all cursor-pointer ${
                  dailyWinsCount === val
                    ? 'bg-[#5e6ad2] text-white border-[#5e6ad2] shadow-sm'
                    : 'bg-[#141516] text-[#d0d6e0] border-[#222326] hover:bg-[#18191a]'
                }`}
              >
                {val}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#5e6ad2] hover:bg-[#828fff] text-white font-medium text-sm py-2.5 px-4 rounded-md transition-colors disabled:bg-[#141516] disabled:text-[#62666d] disabled:cursor-not-allowed shadow-sm cursor-pointer"
        >
          {loading ? 'Running AI Engine...' : 'Evaluate & Replan'}
        </button>
      </form>
    </div>
  );
};
