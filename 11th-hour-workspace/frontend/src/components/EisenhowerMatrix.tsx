import React from 'react';
import { DragOverlay } from '@dnd-kit/core';
import { MatrixQuadrant } from './MatrixQuadrant';
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

interface EisenhowerMatrixProps {
  tasks: Task[];
  onToggleComplete: (id: string, currentStatus: string) => void;
  onFocusTask?: (task: Task) => void;
  activeId: string | null;
  flashingQuadrants?: ('Do' | 'Schedule' | 'Delegate' | 'Delete')[];
}

export const EisenhowerMatrix: React.FC<EisenhowerMatrixProps> = ({
  tasks,
  onToggleComplete,
  onFocusTask,
  activeId,
  flashingQuadrants = []
}) => {
  const openTasks = tasks.filter((t) => t.status !== 'Completed');

  const doTasks = openTasks.filter((t) => t.quadrant === 'Do');
  const scheduleTasks = openTasks.filter((t) => t.quadrant === 'Schedule');
  const delegateTasks = openTasks.filter((t) => t.quadrant === 'Delegate');
  const deleteTasks = openTasks.filter((t) => t.quadrant === 'Delete');

  const activeTask = activeId ? tasks.find((t) => t._id === activeId) : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
      {/* Do First (Urgent & Important) */}
      <MatrixQuadrant
        id="Do"
        title="Do First"
        subtitle="Urgent & Important"
        tasks={doTasks}
        onToggleComplete={onToggleComplete}
        onFocusTask={onFocusTask}
        bgColor="bg-red-950/5"
        isFlashing={flashingQuadrants.includes('Do')}
      />

      {/* Schedule (Not Urgent but Important) */}
      <MatrixQuadrant
        id="Schedule"
        title="Schedule"
        subtitle="Important, Not Urgent"
        tasks={scheduleTasks}
        onToggleComplete={onToggleComplete}
        onFocusTask={onFocusTask}
        bgColor="bg-blue-950/5"
        isFlashing={flashingQuadrants.includes('Schedule')}
      />

      {/* Delegate (Urgent but Not Important) */}
      <MatrixQuadrant
        id="Delegate"
        title="Delegate"
        subtitle="Urgent, Not Important"
        tasks={delegateTasks}
        onToggleComplete={onToggleComplete}
        onFocusTask={onFocusTask}
        bgColor="bg-teal-950/5"
        isFlashing={flashingQuadrants.includes('Delegate')}
      />

      {/* Delete / Eliminate (Not Urgent & Not Important) */}
      <MatrixQuadrant
        id="Delete"
        title="Delete / Eliminate"
        subtitle="Not Urgent & Not Important"
        tasks={deleteTasks}
        onToggleComplete={onToggleComplete}
        onFocusTask={onFocusTask}
        bgColor="bg-slate-900/5"
        isFlashing={flashingQuadrants.includes('Delete')}
      />

      {/* Drag Overlay clone that follows the cursor smoothly */}
      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div className="w-full pointer-events-none scale-[1.02] shadow-[0_10px_30px_rgba(0,0,0,0.5)] transition-transform duration-200">
            <TaskCard
              task={activeTask}
              onToggleComplete={onToggleComplete}
              isOverlay={true}
            />
          </div>
        ) : null}
      </DragOverlay>
    </div>
  );
};
export default EisenhowerMatrix;
