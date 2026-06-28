import React, { useState } from 'react';
import { Sparkles, Calendar, Check, Copy, ClipboardCheck } from 'lucide-react';

interface PlanChange {
  taskId: {
    _id: string;
    title: string;
    quadrant: 'Do' | 'Schedule' | 'Delegate' | 'Delete';
  } | null;
  action: 'Task Reslotted' | 'Urgency Downgraded' | 'Draft ready';
  reason: string;
  proposedSlot?: string;
  draftMessage?: string;
}

interface PlanRevision {
  _id: string;
  triggerType: string;
  changes: PlanChange[];
  userConfirmed: boolean;
}

interface AgentReviewDeckProps {
  plan: PlanRevision | null;
  onCommit: (acceptedChanges: PlanChange[]) => Promise<void>;
  onDismiss: () => void;
  refreshTasks?: () => void;
  loading: boolean;
}

export const AgentReviewDeck: React.FC<AgentReviewDeckProps> = ({
  plan,
  onCommit,
  onDismiss,
  refreshTasks,
  loading
}) => {
  const [selectedChanges, setSelectedChanges] = useState<Record<number, boolean>>({});
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  React.useEffect(() => {
    if (plan && plan.changes) {
      const initial: Record<number, boolean> = {};
      plan.changes.forEach((_, idx) => {
        initial[idx] = true;
      });
      setSelectedChanges(initial);
    }
  }, [plan]);

  if (!plan || !plan.changes || plan.changes.length === 0) return null;

  const getBorderColor = (action: string) => {
    switch (action) {
      case 'Task Reslotted':
        return 'border-l-2 border-teal-500';
      case 'Urgency Downgraded':
        return 'border-l-2 border-amber-500';
      case 'Draft ready':
        return 'border-l-2 border-rose-500';
      default:
        return 'border-l-2 border-[#222326]';
    }
  };

  const handleToggle = (index: number) => {
    setSelectedChanges((prev) => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleConfirm = () => {
    const accepted = plan.changes.filter((_, idx) => selectedChanges[idx]);
    onCommit(accepted)
      .then(() => {
        alert('Plan revisions synced successfully with the Database.');
        if (refreshTasks) {
          refreshTasks();
        }
      })
      .catch((err) => {
        console.error('Failed to commit plan:', err);
      });
  };

  return (
    <div className="bg-[#0f1011] border border-[#222326] rounded-lg p-6 shadow-md animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-5 h-5 text-amber-500 fill-amber-500/20" />
          <h2 className="text-base font-semibold text-[#f7f8f8]">AI Plan Revision</h2>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded">
          Readiness Alert
        </span>
      </div>

      <p className="text-sm text-[#d0d6e0] mb-6">
        Today's readiness score dropped below 60. The autonomous agent proposes the following changes to lower your cognitive load:
      </p>

      <div className="space-y-4 mb-6">
        {plan.changes.map((change, idx) => {
          const isSelected = selectedChanges[idx] ?? true;
          const taskTitle = change.taskId?.title || 'Untitled Task';

          return (
            <div
              key={idx}
              onClick={() => handleToggle(idx)}
              className={`bg-[#141516] border border-[#222326] rounded-md p-4 shadow-sm cursor-pointer transition-all hover:bg-[#18191a] hover:border-[#34343a] ${
                getBorderColor(change.action)
              } ${isSelected ? 'ring-1 ring-[#5e69d1]/40' : 'opacity-40 bg-[#0c0d0e]'}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 pr-3">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                      change.action === 'Task Reslotted'
                        ? 'bg-teal-500/10 text-teal-400 border-teal-500/20'
                        : change.action === 'Urgency Downgraded'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}>
                      {change.action}
                    </span>
                    {change.proposedSlot && (
                      <span className="text-[9px] font-medium text-[#8a8f98] bg-[#0f1011] px-2 py-0.5 rounded border border-[#222326]">
                        {change.proposedSlot}
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-medium text-[#f7f8f8] break-words">{taskTitle}</h4>
                  <p className="text-xs text-[#8a8f98] mt-2 leading-relaxed italic">
                    "{change.reason}"
                  </p>

                  {/* Copyable Draft Message */}
                  {change.action === 'Draft ready' && change.draftMessage && (
                    <div 
                      onClick={(e) => e.stopPropagation()} 
                      className="mt-3 bg-[#0f1011] border border-[#222326] rounded p-2.5 flex items-start justify-between text-xs"
                    >
                      <p className="text-[#d0d6e0] font-mono break-all pr-4">{change.draftMessage}</p>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(change.draftMessage || '', idx)}
                        className="text-[#8a8f98] hover:text-[#5e6ad2] transition-colors p-1 cursor-pointer"
                        title="Copy to clipboard"
                      >
                        {copiedIndex === idx ? (
                          <ClipboardCheck className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Selection Checkbox */}
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                  isSelected ? 'bg-[#5e6ad2] border-[#5e6ad2] text-white' : 'border-[#222326] bg-[#0f1011]'
                }`}>
                  {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex space-x-3">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={loading || !Object.values(selectedChanges).some(Boolean)}
          className="flex-1 bg-[#5e6ad2] hover:bg-[#828fff] text-white font-medium text-sm py-2.5 px-4 rounded-md transition-colors disabled:bg-[#141516] disabled:text-[#62666d] disabled:cursor-not-allowed shadow-sm flex items-center justify-center space-x-2 cursor-pointer"
        >
          <Calendar className="w-4 h-4" />
          <span>{loading ? 'Syncing...' : 'Approve & Sync'}</span>
        </button>

        <button
          type="button"
          onClick={onDismiss}
          disabled={loading}
          className="bg-[#141516] hover:bg-[#18191a] text-[#d0d6e0] border border-[#222326] font-medium text-sm py-2.5 px-4 rounded-md transition-colors shadow-sm cursor-pointer"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};

export default AgentReviewDeck;
