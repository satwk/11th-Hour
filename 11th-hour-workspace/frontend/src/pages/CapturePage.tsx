import React from 'react';
import { useApp, BACKEND_URL, TEST_USER } from '../context/AppContext';
import { BrainDump } from '../components/BrainDump';

export const CapturePage: React.FC = () => {
  const { setTasks, setFlashingQuadrants, loading, setLoading } = useApp();

  const handleAnalyzeBrainDump = async (rawText: string) => {
    try {
      setLoading(true);
      const res = await fetch(`${BACKEND_URL}/tasks/brain-dump`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firebaseId: TEST_USER.firebaseId,
          rawText
        })
      });
      if (!res.ok) throw new Error('Failed to parse brain dump');
      const data = await res.json();
      
      // Add tasks to global state
      setTasks((prev) => [...data.tasks, ...prev]);

      // Trigger the glowing purple success boundary around the affected quadrant(s)
      if (data.tasks && data.tasks.length > 0) {
        const affected = Array.from(new Set(data.tasks.map((t: any) => t.quadrant))) as ('Do' | 'Schedule' | 'Delegate' | 'Delete')[];
        setFlashingQuadrants(affected);
        setTimeout(() => {
          setFlashingQuadrants([]);
        }, 2500);
      }

    } catch (err: any) {
      console.error(err);
      alert('Failed to parse brain dump. Ensure your backend and Gemini API Key are active.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="border-b border-[#222326] pb-5">
        <h1 className="text-2xl font-semibold text-[#f7f8f8] tracking-tight">Brain Capture</h1>
        <p className="text-xs text-[#8a8f98] mt-0.5">Dump your thoughts, emails, or notes to generate structured tasks.</p>
      </div>

      <div className="bg-[#0f1011] border border-[#222326] rounded-lg p-6 shadow-md">
        <BrainDump 
          onAnalyze={handleAnalyzeBrainDump} 
          loading={loading} 
        />
      </div>

      <div className="border border-[#222326] rounded-lg p-5 bg-[#0f1011]/30">
        <span className="text-[10px] uppercase font-mono tracking-wider text-[#62666d] block mb-2 font-semibold">
          Task Parsing Spec
        </span>
        <p className="text-xs text-[#8a8f98] leading-relaxed">
          The extraction engine maps tasks directly to the Eisenhower Matrix (Do, Schedule, Delegate, Delete) and estimates required minutes and cognitive loads. Once parsed, tasks will immediately sync and appear on your matrix board.
        </p>
      </div>
    </div>
  );
};
