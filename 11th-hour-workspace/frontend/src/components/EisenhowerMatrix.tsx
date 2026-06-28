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
  refreshTasks?: () => void;
}

export const EisenhowerMatrix: React.FC<EisenhowerMatrixProps> = ({
  tasks,
  onToggleComplete,
  onFocusTask,
  activeId,
  flashingQuadrants = [],
  refreshTasks
}) => {
  const openTasks = tasks.filter((t) => t.status !== 'Completed');

  const getNumericLoad = (load: any): number => {
    if (typeof load === 'number') return load;
    if (!load) return 1;
    const s = String(load).toLowerCase();
    if (s === 'high' || s === '5' || s === '4') return 5;
    if (s === 'medium' || s === '3') return 3;
    if (s === 'low' || s === '2' || s === '1') return 1;
    const num = parseInt(s, 10);
    return isNaN(num) ? 1 : num;
  };

  const sortTasksByLoad = (taskList: typeof openTasks) => {
    return [...taskList].sort((a, b) => getNumericLoad(b.cognitiveLoad) - getNumericLoad(a.cognitiveLoad));
  };

  const doTasks = sortTasksByLoad(openTasks.filter((t) => t.quadrant === 'Do'));
  const scheduleTasks = sortTasksByLoad(openTasks.filter((t) => t.quadrant === 'Schedule'));
  const delegateTasks = sortTasksByLoad(openTasks.filter((t) => t.quadrant === 'Delegate'));
  const deleteTasks = sortTasksByLoad(openTasks.filter((t) => t.quadrant === 'Delete'));

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
        refreshTasks={refreshTasks}
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
        refreshTasks={refreshTasks}
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
        refreshTasks={refreshTasks}
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
        refreshTasks={refreshTasks}
      />

      {/* Drag Overlay clone that follows the cursor smoothly */}
      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div className="w-full pointer-events-none scale-[1.02] shadow-[0_10px_30px_rgba(0,0,0,0.5)] transition-transform duration-200">
            <TaskCard
              task={activeTask}
              onToggleComplete={onToggleComplete}
              isOverlay={true}
              refreshTasks={refreshTasks}
            />
          </div>
        ) : null}
      </DragOverlay>
    </div>
  );
};
export default EisenhowerMatrix;
