import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Play, ClipboardCheck, Clock } from 'lucide-react';
import { useApp, BACKEND_URL } from '../context/AppContext';
import { FocusMode } from '../components/FocusMode';

export const FocusPage: React.FC = () => {
  const { tasks, setTasks } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTaskId = searchParams.get('taskId');

  const openTasks = tasks.filter((t) => t.status !== 'Completed');
  const activeTask = tasks.find((t) => t._id === activeTaskId) || null;

  const handleToggleComplete = async (id: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'Completed' ? 'Not Started' : 'Completed';
      const res = await fetch(`${BACKEND_URL}/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) throw new Error('Failed to update status');
      
      setTasks((prev) =>
        prev.map((t) => (t._id === id ? { ...t, status: newStatus } : t))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const getLoadColor = (load: string) => {
    switch (load) {
      case 'High': return 'text-red-400 border-red-500/20 bg-red-500/10';
      case 'Medium': return 'text-amber-400 border-amber-500/20 bg-amber-500/10';
      default: return 'text-slate-400 border-slate-500/20 bg-slate-500/10';
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-[#222326] pb-5">
        <h1 className="text-2xl font-semibold text-[#f7f8f8] tracking-tight">Focus Space</h1>
        <p className="text-xs text-[#8a8f98] mt-0.5">Select a priority item to launch a distraction-free countdown session.</p>
      </div>

      {activeTask ? (
        <FocusMode
          task={activeTask}
          onClose={() => setSearchParams({})}
          onComplete={(id) => {
            handleToggleComplete(id, 'Not Started');
            setSearchParams({});
          }}
        />
      ) : (
        <div className="max-w-3xl space-y-4">
          <h2 className="text-sm font-semibold text-[#8a8f98] uppercase tracking-wider font-mono">
            Select priority task to start
          </h2>

          {openTasks.length === 0 ? (
            <div className="border border-dashed border-[#222326] rounded-lg p-12 text-center bg-[#0f1011]/30">
              <ClipboardCheck className="w-8 h-8 text-[#62666d] mx-auto mb-3" />
              <p className="text-sm font-medium text-[#f7f8f8]">All caught up!</p>
              <p className="text-xs text-[#8a8f98] mt-1">There are no open tasks. Parse a brain dump first.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {openTasks.map((task) => (
                <div
                  key={task._id}
                  onClick={() => setSearchParams({ taskId: task._id })}
                  className="bg-[#0f1011] border border-[#222326] rounded-lg p-5 flex items-center justify-between hover:bg-[#141516] hover:border-[#34343a] transition-all cursor-pointer group shadow-sm"
                >
                  <div className="space-y-1.5 min-w-0 pr-4">
                    <span className={`text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded border ${getLoadColor(task.cognitiveLoad)}`}>
                      {task.cognitiveLoad} Load
                    </span>
                    <h3 className="text-sm font-medium text-[#f7f8f8] truncate leading-snug">{task.title}</h3>
                    <div className="flex items-center text-[10px] text-[#8a8f98] space-x-3 font-mono">
                      <span className="flex items-center">
                        <Clock className="w-3 h-3 mr-1 text-[#62666d]" />
                        {task.estimatedDuration}m
                      </span>
                      <span>•</span>
                      <span>Quadrant: {task.quadrant}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="p-2.5 rounded-full bg-[#141516] group-hover:bg-[#5e6ad2] group-hover:text-white border border-[#222326] text-[#8a8f98] transition-all shadow-sm flex items-center justify-center shrink-0 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current stroke-none ml-0.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
