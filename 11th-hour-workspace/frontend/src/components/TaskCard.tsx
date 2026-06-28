import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Link2, CheckCircle2, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { BACKEND_URL } from '../context/AppContext';

interface Task {
  _id: string;
  title: string;
  quadrant: 'Do' | 'Schedule' | 'Delegate' | 'Delete';
  cognitiveLoad: 'Low' | 'Medium' | 'High';
  estimatedDuration: number;
  status: 'Not Started' | 'In Progress' | 'Completed';
  externallyDependent: boolean;
  scheduleConstraint?: {
    targetDate?: string;
    timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'any';
    exactStartTime?: string | null;
    durationOverride?: number | null;
  };
}

interface TaskCardProps {
  task: Task;
  onToggleComplete: (id: string, currentStatus: string) => void;
  onFocusTask?: (task: Task) => void;
  isOverlay?: boolean;
  refreshTasks?: () => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onToggleComplete,
  onFocusTask,
  isOverlay = false,
  refreshTasks
}) => {
  const [isStruck, setIsStruck] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task._id, disabled: isOverlay });

  const style = {
    transform: isDragging ? undefined : CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.15 : 1, // Leaves a dim placeholder trace in the source quadrant
    cursor: isOverlay ? 'grabbing' : 'grab'
  };

  const getLoadBadgeColor = (load: 'Low' | 'Medium' | 'High') => {
    switch (load) {
      case 'High':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'Medium':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'Low':
        return 'bg-[#141516] text-[#d0d6e0] border-[#222326]';
      default:
        return 'bg-[#141516] text-[#d0d6e0] border-[#222326]';
    }
  };

  const dragProps = isOverlay ? {} : { ...attributes, ...listeners };
  const dragRef = isOverlay ? null : setNodeRef;

  return (
    <motion.div
      layout
      ref={dragRef}
      style={style}
      {...dragProps}
      className={`group relative bg-[#0f1011] border border-[#222326] rounded-md p-4 hover:bg-[#141516] transition-all duration-500 ease-in-out select-none ${isCompleting ? 'opacity-0 scale-95 h-0 mb-0 !p-0 !border-0 overflow-hidden' : 'opacity-100 scale-100'
        } ${task.status === 'Completed' ? 'opacity-40 bg-[#0c0d0e] border-[#1d1f23]' : ''
        }`}
    >
      <div className="flex items-start space-x-3">
        {/* Completion Checkbox */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (task.status === 'Completed') {
              onToggleComplete(task._id, task.status);
              return;
            }
            setIsStruck(true);
            setTimeout(() => {
              setIsCompleting(true);
              setTimeout(async () => {
                try {
                  const res = await fetch(`${BACKEND_URL}/tasks/${task._id}/complete`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' }
                  });
                  if (!res.ok) throw new Error('Failed to update task to complete');
                  if (refreshTasks) {
                    refreshTasks();
                  } else {
                    onToggleComplete(task._id, task.status);
                  }
                } catch (err) {
                  console.error(err);
                  setIsStruck(false);
                  setIsCompleting(false);
                }
              }, 500);
            }, 800);
          }}
          className="mt-0.5 text-[#62666d] hover:text-[#5e6ad2] transition-colors cursor-pointer"
        >
          <CheckCircle2
            className={`w-5 h-5 ${task.status === 'Completed' || isStruck ? 'fill-emerald-500 text-emerald-500 stroke-none' : 'text-[#62666d]'
              }`}
          />
        </button>

        {/* Task Title */}
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-normal leading-snug break-words transition-all duration-300 ${isStruck || isCompleting ? 'line-through text-gray-500' : 'text-white'
              } ${!isStruck && !isCompleting && task.status === 'Completed' ? 'line-through text-[#62666d]' : ''
              }`}
          >
            {task.title}
          </p>

          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            {/* Cognitive Load Tag */}
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${getLoadBadgeColor(task.cognitiveLoad)}`}>
              {task.cognitiveLoad} Load
            </span>

            {/* Estimated Duration */}
            <span className="flex items-center text-[10px] font-mono text-[#8a8f98] bg-[#141516] px-2 py-0.5 rounded border border-[#222326]">
              <Clock className="w-3.5 h-3.5 mr-1 text-[#62666d]" />
              {task.scheduleConstraint?.durationOverride != null 
                ? `${task.scheduleConstraint.durationOverride}m` 
                : `${task.estimatedDuration}m`}
            </span>

            {/* External Dependency Icon */}
            {task.externallyDependent && (
              <span className="flex items-center text-[10px] text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                <Link2 className="w-3 h-3 mr-1" />
                Dependent
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Focus Mode button (Hover state) */}
      {task.status !== 'Completed' && onFocusTask && !isOverlay && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onFocusTask(task);
          }}
          className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-[#5e6ad2] hover:text-white rounded px-2.5 py-0.5 text-[10px] font-semibold cursor-pointer"
        >
          Focus
        </button>
      )}
    </motion.div>
  );
};
export default TaskCard;
