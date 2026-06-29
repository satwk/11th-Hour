import React, { useState } from 'react';
import { Sparkles, Calendar, Check, Copy, ClipboardCheck } from 'lucide-react';

interface PlanChange {
  taskId: {
    _id: string;
    title: string;
    quadrant: 'Do' | 'Schedule' | 'Delegate' | 'Delete';
  } | null;
  action: 'defer_to_schedule' | 'downgrade_to_shallow' | 'promote' | 'Task Reslotted' | 'Urgency Downgraded' | 'Draft ready' | 'reslot' | 'rechunk' | 'downgrade' | 'draft-message' | 'requeue';
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

interface PlanRevisionStackProps {
  plan: PlanRevision | null;
  onCommit: (acceptedChanges: PlanChange[]) => Promise<void>;
  onDismiss: () => void;
  onSyncComplete?: () => void;
  refreshTasks?: () => void;
  loading: boolean;
}

export const PlanRevisionStack: React.FC<PlanRevisionStackProps> = ({
  plan,
  onCommit,
  onDismiss,
  onSyncComplete,
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
      case 'defer_to_schedule':
        return 'border-l-2 border-rose-500';
      case 'downgrade_to_shallow':
        return 'border-l-2 border-amber-500';
      case 'promote':
        return 'border-l-2 border-emerald-500';
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

  const handleConfirm = async () => {
    const accepted = plan.changes.filter((_, idx) => selectedChanges[idx]);
    await onCommit(accepted);
    if (refreshTasks) {
      refreshTasks();
    }
    if (onSyncComplete) {
      onSyncComplete();
    }
  };

  const isSurplusMode = plan && plan.changes && plan.changes.length > 0 && plan.changes[0].action === 'promote';

  return (
    <div className="bg-[#0f1011] border border-[#222326] rounded-lg p-6 shadow-md animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Sparkles className={`w-5 h-5 ${isSurplusMode ? 'text-teal-500 fill-teal-500/20' : 'text-amber-500 fill-amber-500/20'}`} />
          <h2 className="text-base font-semibold text-[#f7f8f8]">AI Plan Revision</h2>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
          isSurplusMode 
            ? 'bg-teal-900 text-teal-300 border-teal-700/50' 
            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
        }`}>
          {isSurplusMode ? 'Capacity Surplus' : 'Readiness Alert'}
        </span>
      </div>

      <p className="text-sm text-[#d0d6e0] mb-6">
        {isSurplusMode 
          ? "Today's readiness score indicates extra focus capacity. The autonomous agent proposes promoting the following items into your Do First list:" 
          : "Today's readiness score dropped below 60. The autonomous agent proposes the following changes to lower your cognitive load:"}
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
                      change.action === 'defer_to_schedule'
                        ? 'bg-rose-900/50 text-rose-400 border-rose-700'
                        : change.action === 'downgrade_to_shallow'
                        ? 'bg-amber-900/50 text-amber-400 border-amber-700'
                        : change.action === 'promote'
                        ? 'bg-teal-900/50 text-teal-400 border-teal-700'
                        : change.action === 'Task Reslotted'
                        ? 'bg-teal-500/10 text-teal-400 border-teal-500/20'
                        : change.action === 'Urgency Downgraded'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}>
                      {change.action === 'defer_to_schedule'
                        ? 'DEFER'
                        : change.action === 'downgrade_to_shallow'
                        ? 'DOWNGRADE'
                        : change.action === 'promote'
                        ? 'PROMOTE'
                        : change.action}
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
export default PlanRevisionStack;
