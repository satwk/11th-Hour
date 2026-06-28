import React, { useState } from 'react';

interface BrainDumpProps {
  onAnalyze: (rawText: string) => Promise<void>;
  loading: boolean;
}

export const BrainDump: React.FC<BrainDumpProps> = ({ onAnalyze, loading }) => {
  const [rawText, setRawText] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim()) return;
    await onAnalyze(rawText);
    setRawText(''); // clear on success
  };

  return (
    <div className="bg-[#0f1011] border border-[#222326] rounded-lg p-6 shadow-md">
      <h2 className="text-lg font-medium text-[#f7f8f8] mb-2">Brain Dump</h2>
      <p className="text-sm text-[#d0d6e0] mb-4">
        Type whatever is on your mind. The AI will categorize them into Eisenhower quadrants, estimate durations, and assess cognitive loads.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <textarea
          rows={4}
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="e.g., I need to finish slides for board meeting tomorrow. Also, should schedule doctor checkup next week."
          className="w-full bg-[#141516] text-[#f7f8f8] border border-[#222326] rounded-md p-3 text-sm focus:outline-none focus:border-[#34343a] focus:ring-1 focus:ring-[#5e6ad2] placeholder-[#62666d]"
          disabled={loading}
        />

        <div className="flex justify-between items-center">
          <span className="text-xs text-[#8a8f98]">
            Gemini 3.1 Flash-Lite model handles parsing.
          </span>
          <button
            type="submit"
            disabled={loading || !rawText.trim()}
            className="bg-[#5e6ad2] hover:bg-[#828fff] text-white font-medium text-sm py-2 px-6 rounded-md transition-colors disabled:bg-[#141516] disabled:text-[#62666d] disabled:cursor-not-allowed shadow-sm cursor-pointer"
          >
            {loading ? 'Processing Dump...' : 'Extract Tasks'}
          </button>
        </div>
      </form>
    </div>
  );
};
