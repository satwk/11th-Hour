import React from 'react';
import { useApp, BACKEND_URL, TEST_USER } from '../context/AppContext';
import { ReadinessLogger } from '../components/ReadinessLogger';

export const ReadinessPage: React.FC = () => {
  const { 
    readinessScore, 
    setReadinessScore, 
    setLocalScore, 
    setActivePlan, 
    loading, 
    setLoading, 
    handleStatsChange 
  } = useApp();

  const handleReplan = async (stats: { energyLevel: number; sleepHours: number; dailyWinsCount: number }) => {
    try {
      setLoading(true);
      const res = await fetch(`${BACKEND_URL}/agent/daily-replan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firebaseId: TEST_USER.firebaseId,
          energyStats: stats
        })
      });
      if (!res.ok) throw new Error('Failed to run replan engine');
      const data = await res.json();
      setReadinessScore(data.score);
      setLocalScore(data.score);
      
      if (data.planRevision) {
        setActivePlan(data.planRevision);
        alert(`Evaluation completed. Readiness score: ${data.score}/100. AI proposed adjustments for ${data.planRevision.changes?.length} High-load task(s). View them on the Matrix dashboard.`);
      } else {
        setActivePlan(null);
        alert(data.message);
      }
    } catch (err: any) {
      console.error(err);
      alert('Failed to execute replan. Ensure your Gemini API Key is configured in backend/.env.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="border-b border-[#222326] pb-5">
        <h1 className="text-2xl font-semibold text-[#f7f8f8] tracking-tight">Daily Readiness</h1>
        <p className="text-xs text-[#8a8f98] mt-0.5">Evaluate focus capacity and automatically reschedule overloaded items.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Logger sliders */}
        <div className="md:col-span-1">
          <ReadinessLogger
            onReplan={handleReplan}
            currentScore={readinessScore}
            loading={loading}
            onStatsChange={handleStatsChange}
          />
        </div>

        {/* Readiness Info Details */}
        <div className="md:col-span-1 space-y-6 border border-[#222326] rounded-lg p-6 bg-[#0f1011] shadow-md">
          <h2 className="text-base font-semibold text-[#f7f8f8] tracking-tight">Focus Mechanics</h2>
          
          <div className="space-y-4">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-[#f7f8f8] block">Readiness Score Threshold</span>
              <p className="text-xs text-[#8a8f98] leading-relaxed">
                If your calculated readiness score drops below **60/100**, the system automatically engages the AI agent to replan open **High** cognitive load tasks to prevent burn-out.
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-semibold text-[#f7f8f8] block">Workplace Accent Glow</span>
              <p className="text-xs text-[#8a8f98] leading-relaxed">
                The ambient backdrop glow dynamically reacts to your current energy sliders. A violet glow indicates high readiness, while deep amber indicates exhaustion.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
