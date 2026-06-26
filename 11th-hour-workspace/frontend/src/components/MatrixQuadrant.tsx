import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { motion, AnimatePresence } from 'framer-motion';
import { TaskCard } from './TaskCard';

interface Task {
  _id: string;
  title: string;
  quadrant: 'Do' | 'Schedule' | 'Delegate' | 'Delete';
  cognitiveLoad: 'Low' | 'Medium' | 'High';
  estimatedDuration: number;
  status: 'Not Started' | 'In Progress' | 'Completed';
  externallyDependent: boolean;
}

interface MatrixQuadrantProps {
  id: 'Do' | 'Schedule' | 'Delegate' | 'Delete';
  title: string;
  subtitle: string;
  tasks: Task[];
  onToggleComplete: (id: string, currentStatus: string) => void;
  onFocusTask?: (task: Task) => void;
  bgColor: string;
  isFlashing?: boolean;
}

export const MatrixQuadrant: React.FC<MatrixQuadrantProps> = ({
  id,
  title,
  subtitle,
  tasks,
  onToggleComplete,
  onFocusTask,
  bgColor,
  isFlashing = false
}) => {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col h-[380px] border border-[#222326] rounded-lg p-5 transition-all bg-[#0a0a0b] relative overflow-hidden ${bgColor} ${
        isOver ? 'ring-1 ring-[#5e6ad2] border-[#34343a] scale-[1.005]' : ''
      }`}
    >
      {/* Success boundary flash */}
      <AnimatePresence>
        {isFlashing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.8, ease: 'easeInOut' }}
            className="absolute inset-0 border-2 border-purple-500 rounded-lg pointer-events-none shadow-[0_0_15px_rgba(168,85,247,0.4)] z-10"
          />
        )}
      </AnimatePresence>

      <div className="mb-4">
        <h3 className="text-sm font-semibold text-[#f7f8f8]">{title}</h3>
        <p className="text-xs text-[#8a8f98] mt-0.5">{subtitle}</p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        <SortableContext items={tasks.map((t) => t._id)} strategy={verticalListSortingStrategy}>
          {tasks.length === 0 ? (
            <div className="h-full flex items-center justify-center border border-dashed border-[#222326] rounded-md p-6 text-center text-[#62666d] text-xs">
              Drag tasks here
            </div>
          ) : (
            tasks.map((task) => (
              <TaskCard
                key={task._id}
                task={task}
                onToggleComplete={onToggleComplete}
                onFocusTask={onFocusTask}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
};
export default MatrixQuadrant;
