import { useState, useEffect } from 'react';
import { 
  DndContext, 
  useSensor, 
  useSensors, 
  PointerSensor, 
  TouchSensor 
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';

import { BrainDump } from './components/BrainDump';
import { ReadinessLogger } from './components/ReadinessLogger';
import { EisenhowerMatrix } from './components/EisenhowerMatrix';
import { PlanRevisionStack } from './components/PlanRevisionStack';
import { FocusMode } from './components/FocusMode';

const BACKEND_URL = 'http://localhost:5000/api';
// Default user details for local testing (Auth will be integrated in Step 5)
const TEST_USER = {
  firebaseId: 'test-fb-user-123',
  email: 'testuser@example.com'
};

interface Task {
  _id: string;
  title: string;
  quadrant: 'Do' | 'Schedule' | 'Delegate' | 'Delete';
  cognitiveLoad: 'Low' | 'Medium' | 'High';
  estimatedDuration: number;
  status: 'Not Started' | 'In Progress' | 'Completed';
  externallyDependent: boolean;
}

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activePlan, setActivePlan] = useState<any | null>(null);
  const [readinessScore, setReadinessScore] = useState<number | null>(null);
  const [focusTask, setFocusTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Drag and drop state
  const [activeId, setActiveId] = useState<string | null>(null);

  // Live focus potential metrics & score
  const [localScore, setLocalScore] = useState<number>(69);

  // Success boundary flash state
  const [flashingQuadrants, setFlashingQuadrants] = useState<('Do' | 'Schedule' | 'Delegate' | 'Delete')[]>([]);

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

  useEffect(() => {
    fetchTasks();
  }, []);

  const getGlowDetails = (score: number) => {
    if (score < 50) {
      return { status: 'exhausted', color: 'rgba(217, 119, 6, 0.12)', label: 'Exhausted' };
    } else if (score >= 75) {
      return { status: 'focused', color: 'rgba(94, 106, 210, 0.15)', label: 'Ready & Focused' };
    } else {
      return { status: 'balanced', color: 'rgba(6, 182, 212, 0.12)', label: 'Balanced & Alert' };
    }
  };

  const handleStatsChange = (stats: { energyLevel: number; sleepHours: number; dailyWinsCount: number }) => {
    const energyScore = (stats.energyLevel / 5) * 50;
    const sleepScore = Math.min(stats.sleepHours / 8, 1) * 40;
    const winsScore = Math.min(stats.dailyWinsCount / 5, 1) * 10;
    const score = Math.round(energyScore + sleepScore + winsScore);
    setLocalScore(score);
  };

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${BACKEND_URL}/tasks?firebaseId=${TEST_USER.firebaseId}`);
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const data = await res.json();
      setTasks(data);
      setApiError(null);
    } catch (err: any) {
      console.error(err);
      setApiError('Backend server is offline. Please make sure the Express backend is running on port 5000.');
    } finally {
      setLoading(false);
    }
  };

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
      setTasks((prev) => [...data.tasks, ...prev]);
      setApiError(null);

      // Flash glowing purple success boundary around the affected quadrant(s)
      if (data.tasks && data.tasks.length > 0) {
        const affected = Array.from(new Set(data.tasks.map((t: any) => t.quadrant))) as ('Do' | 'Schedule' | 'Delegate' | 'Delete')[];
        setFlashingQuadrants(affected);
        setTimeout(() => {
          setFlashingQuadrants([]);
        }, 2000);
      }
    } catch (err: any) {
      console.error(err);
      setApiError('Failed to parse brain dump. Check your backend status and Gemini API configuration.');
    } finally {
      setLoading(false);
    }
  };

  const handleReplan = async (stats: { energyLevel: number; sleepHours: number; dailyWinsCount: number }) => {
    try {
      setLoading(true);
      const res = await fetch(`${BACKEND_URL}/agent/daily-replan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firebaseId: TEST_USER.firebaseId,
          energyStats: stats
        })
      });
      if (!res.ok) throw new Error('Failed to run replan engine');
      const data = await res.json();
      setReadinessScore(data.score);
      setLocalScore(data.score); // sync workspace glow with computed server score
      
      if (data.planRevision) {
        setActivePlan(data.planRevision);
      } else {
        setActivePlan(null);
        alert(data.message);
      }
      setApiError(null);
    } catch (err: any) {
      console.error(err);
      setApiError('Failed to execute replan. Ensure your Gemini API Key is configured in backend/.env.');
    } finally {
      setLoading(false);
    }
  };

  const handleCommitPlan = async (acceptedChanges: any[]) => {
    try {
      setLoading(true);
      await Promise.all(
        acceptedChanges.map(async (c: any) => {
          if (!c.taskId) return;
          const taskId = c.taskId._id || c.taskId;
          
          let updates: any = {};
          if (c.action === 'Urgency Downgraded') {
            const originalTask = tasks.find(t => t._id === taskId);
            if (originalTask) {
              if (originalTask.quadrant === 'Do') updates.quadrant = 'Schedule';
              else if (originalTask.quadrant === 'Schedule') updates.quadrant = 'Delegate';
            }
          } else if (c.action === 'Task Reslotted') {
            updates.status = 'In Progress';
          }
          
          await fetch(`${BACKEND_URL}/tasks/${taskId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
          });
        })
      );

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
      await fetchTasks();
      alert('Plan revisions synced successfully with the Database.');
    } catch (err) {
      console.error(err);
      alert('Failed to commit plan changes.');
    } finally {
      setLoading(false);
    }
  };

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
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const targetQuadrant = over.id as 'Do' | 'Schedule' | 'Delegate' | 'Delete';

    const task = tasks.find((t) => t._id === taskId);
    if (!task || task.quadrant === targetQuadrant) return;

    setTasks((prev) =>
      prev.map((t) => (t._id === taskId ? { ...t, quadrant: targetQuadrant } : t))
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

  const glow = getGlowDetails(localScore);

  return (
    <div className="min-h-screen bg-[#0c0d0e] text-[#f7f8f8] font-sans selection:bg-[#5e6ad2]/20 pb-16 relative overflow-hidden">
      {/* Dynamic Ambient Background Glow */}
      <div 
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] rounded-full blur-[140px] pointer-events-none transition-all duration-1000 z-0"
        style={{
          background: `radial-gradient(circle, ${glow.color} 0%, transparent 80%)`
        }}
      />

      {/* App Nav Bar */}
      <nav className="bg-[#0f1011] border-b border-[#222326] sticky top-0 z-40 px-6 py-4 shadow-md relative z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="w-7 h-7 bg-[#5e6ad2] rounded-md flex items-center justify-center text-white font-semibold text-sm shadow-md">
              11
            </span>
            <div>
              <span className="font-semibold text-[#f7f8f8] text-lg tracking-tight">11th Hour</span>
              <span className="text-xs text-[#8a8f98] ml-2 font-mono">v1.2 (Linear Workspace)</span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-xs text-[#8a8f98]">
              Connected: <strong className="text-[#f7f8f8] font-normal">{TEST_USER.email}</strong>
            </span>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 mt-8 relative z-10">
        {apiError && (
          <div className="mb-8 p-4 bg-rose-950/20 border border-rose-500/30 text-rose-400 rounded-md text-sm flex flex-col space-y-2 animate-fade-in">
            <span className="font-bold">⚠️ Connection Alert</span>
            <span>{apiError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Sidebar panels */}
          <div className="space-y-6 lg:col-span-1">
            <ReadinessLogger 
              onReplan={handleReplan} 
              currentScore={readinessScore} 
              loading={loading} 
              onStatsChange={handleStatsChange}
            />
            
            <BrainDump 
              onAnalyze={handleAnalyzeBrainDump} 
              loading={loading} 
            />

            {/* AI Revision Stack section */}
            <PlanRevisionStack
              plan={activePlan}
              onCommit={handleCommitPlan}
              onDismiss={() => setActivePlan(null)}
              loading={loading}
            />
          </div>

          {/* Right Main Eisenhower Matrix */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#0f1011] border border-[#222326] rounded-lg p-6 shadow-md">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-medium text-[#f7f8f8] tracking-tight">Eisenhower Matrix</h2>
                  <p className="text-xs text-[#8a8f98] mt-0.5">Drag and drop tasks to adjust quadrants dynamically.</p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      const title = prompt('Enter task description:');
                      if (title) handleQuickAddTask(title, 'Do');
                    }}
                    className="flex items-center space-x-1.5 text-xs text-[#f7f8f8] hover:text-white border border-[#222326] rounded-md px-3 py-1.5 bg-[#141516] hover:bg-[#18191a] transition-all font-medium cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Quick Add Task</span>
                  </button>
                </div>
              </div>

              {/* DnD kit wrapping Matrix */}
              <DndContext 
                sensors={sensors} 
                onDragStart={(event) => setActiveId(event.active.id as string)}
                onDragCancel={() => setActiveId(null)}
                onDragEnd={handleDragEnd}
              >
                <EisenhowerMatrix
                  tasks={tasks}
                  onToggleComplete={handleToggleComplete}
                  onFocusTask={(task) => setFocusTask(task)}
                  activeId={activeId}
                  flashingQuadrants={flashingQuadrants}
                />
              </DndContext>
            </div>
          </div>
        </div>
      </main>

      {/* Focus Mode Overlay */}
      <AnimatePresence>
        {focusTask && (
          <FocusMode
            task={focusTask}
            onClose={() => setFocusTask(null)}
            onComplete={(id) => handleToggleComplete(id, 'Not Started')}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
