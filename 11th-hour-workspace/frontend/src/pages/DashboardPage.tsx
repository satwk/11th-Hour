import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor,
  closestCorners
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { Plus } from 'lucide-react';
import { useApp, BACKEND_URL, TEST_USER } from '../context/AppContext';
import { EisenhowerMatrix } from '../components/EisenhowerMatrix';
import { AgentReviewDeck } from '../components/AgentReviewDeck';

export const DashboardPage: React.FC = () => {
  const {
    tasks,
    setTasks,
    activePlan,
    setActivePlan,
    fetchTasks,
    loading,
    flashingQuadrants
  } = useApp();

  const navigate = useNavigate();
  const [activeId, setActiveId] = useState<string | null>(null);

  // Setup sensors for dnd-kit
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

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

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const result = { destination: event.over };
    if (!result.destination) return;
    const { active, over } = event;

    const taskId = active.id as string;
    let targetQuadrant = over.id as string;

    // If targetQuadrant is a taskId (meaning dropped on another task card), resolve its actual quadrant
    if (targetQuadrant !== 'Do' && targetQuadrant !== 'Schedule' && targetQuadrant !== 'Delegate' && targetQuadrant !== 'Delete') {
      const targetTask = tasks.find((t) => t._id === targetQuadrant);
      if (targetTask) {
        targetQuadrant = targetTask.quadrant;
      } else {
        return;
      }
    }

    const task = tasks.find((t) => t._id === taskId);
    if (!task) return;

    if (task.quadrant === targetQuadrant) {
      // Reorder within the same quadrant
      const oldIndex = tasks.findIndex((t) => t._id === taskId);
      const newIndex = tasks.findIndex((t) => t._id === over.id);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        setTasks((prev) => {
          const updated = [...prev];
          const [moved] = updated.splice(oldIndex, 1);
          updated.splice(newIndex, 0, moved);
          return updated;
        });
      }
      return;
    }

    setTasks((prev) =>
      prev.map((t) => (t._id === taskId ? { ...t, quadrant: targetQuadrant as any } : t))
    );

    try {
      const res = await fetch(`${BACKEND_URL}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quadrant: targetQuadrant })
      });
      if (!res.ok) throw new Error('Failed to save quadrant change');
    } catch (err) {
      console.error(err);
      setTasks((prev) =>
        prev.map((t) => (t._id === taskId ? { ...t, quadrant: task.quadrant } : t))
      );
    }
  };

  const handleQuickAddTask = async (title: string, quadrant: 'Do' | 'Schedule' | 'Delegate' | 'Delete') => {
    try {
      const res = await fetch(`${BACKEND_URL}/tasks/brain-dump`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firebaseId: TEST_USER.firebaseId,
          rawText: `${title} (Quadrant: ${quadrant}, Load: Low, Duration: 30)`
        })
      });
      if (res.ok) await fetchTasks();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCommitPlan = async (acceptedChanges: any[]) => {
    try {
      const approvedTaskIds = acceptedChanges
        .map((c: any) => (c.taskId ? (c.taskId._id || c.taskId) : null))
        .filter(Boolean);

      const confirmRes = await fetch(`${BACKEND_URL}/agent/plan-revisions/${activePlan._id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedTaskIds })
      });

      if (!confirmRes.ok) {
        throw new Error('Failed to confirm plan revisions on backend');
      }

      await fetch(`${BACKEND_URL}/calendar/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firebaseId: TEST_USER.firebaseId,
          planRevisionId: activePlan._id,
          userConfirmed: true
        })
      }).catch(() => null);

      setActivePlan(null);
    } catch (err) {
      console.error('Failed to sync plan revisions:', err);
      throw err;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-[#222326] pb-5">
        <div>
          <h1 className="text-2xl font-semibold text-[#f7f8f8] tracking-tight">Productivity Space</h1>
          <p className="text-xs text-[#8a8f98] mt-0.5">Visualize priorities and run task scheduling constraints.</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              const title = prompt('Enter task description:');
              if (title) handleQuickAddTask(title, 'Do');
            }}
            className="flex items-center space-x-1.5 text-xs text-[#f7f8f8] hover:text-white border border-[#222326] rounded-md px-3.5 py-2 bg-[#141516] hover:bg-[#18191a] transition-all font-semibold cursor-pointer shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 text-[#5e6ad2]" />
            <span>Quick Task</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Right Main Eisenhower Matrix (Spans 2 cols) */}
        <div className="lg:col-span-2 space-y-6 bg-[#0f1011] border border-[#222326] rounded-lg p-6 shadow-md">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-[#f7f8f8] tracking-tight">Eisenhower Priority Matrix</h2>
            <p className="text-xs text-[#8a8f98] mt-0.5">Drag cards to distribute load based on urgency and importance.</p>
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={(event) => setActiveId(event.active.id as string)}
            onDragCancel={() => setActiveId(null)}
            onDragEnd={handleDragEnd}
          >
            <EisenhowerMatrix
              tasks={tasks}
              onToggleComplete={handleToggleComplete}
              onFocusTask={(task) => navigate(`/focus?taskId=${task._id}`)}
              activeId={activeId}
              flashingQuadrants={flashingQuadrants}
              refreshTasks={fetchTasks}
            />
          </DndContext>
        </div>

        {/* AI Action Revision stack in right sidebar column */}
        <div className="lg:col-span-1">
          {activePlan ? (
            <AgentReviewDeck
              plan={activePlan}
              onCommit={handleCommitPlan}
              onDismiss={() => setActivePlan(null)}
              refreshTasks={fetchTasks}
              loading={loading}
            />
          ) : (
            <div className="border border-[#222326] border-dashed rounded-lg p-6 text-center bg-[#0f1011]/30">
              <span className="text-xs text-[#62666d] font-semibold uppercase tracking-wider block mb-1">
                AI Agent Log
              </span>
              <p className="text-xs text-[#8a8f98] leading-relaxed">
                Log daily readiness below 60 to trigger auto-replanning on your high cognitive load items.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
