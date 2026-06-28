import React, { createContext, useContext, useState, useEffect } from 'react';

export interface Task {
  _id: string;
  title: string;
  quadrant: 'Do' | 'Schedule' | 'Delegate' | 'Delete';
  cognitiveLoad: 'Low' | 'Medium' | 'High';
  estimatedDuration: number;
  status: 'Not Started' | 'In Progress' | 'Completed';
  externallyDependent: boolean;
}

interface AppContextType {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  activePlan: any | null;
  setActivePlan: (plan: any | null) => void;
  readinessScore: number | null;
  setReadinessScore: (score: number | null) => void;
  localScore: number;
  setLocalScore: (score: number) => void;
  flashingQuadrants: ('Do' | 'Schedule' | 'Delegate' | 'Delete')[];
  setFlashingQuadrants: (quads: ('Do' | 'Schedule' | 'Delegate' | 'Delete')[]) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  apiError: string | null;
  setApiError: (error: string | null) => void;
  googleConnected: boolean;
  setGoogleConnected: (connected: boolean) => void;
  googleAccessToken: string | null;
  saveGoogleToken: (token: string | null) => Promise<void>;
  fetchTasks: () => Promise<void>;
  handleStatsChange: (stats: { energyLevel: number; sleepHours: number; dailyWinsCount: number }) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const BACKEND_URL = 'http://localhost:5000/api';
export const TEST_USER = {
  firebaseId: 'test-fb-user-123',
  email: 'testuser@example.com'
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activePlan, setActivePlan] = useState<any | null>(null);
  const [readinessScore, setReadinessScore] = useState<number | null>(null);
  const [localScore, setLocalScore] = useState<number>(69);
  const [flashingQuadrants, setFlashingQuadrants] = useState<('Do' | 'Schedule' | 'Delegate' | 'Delete')[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [googleConnected, setGoogleConnected] = useState<boolean>(false);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);

  // Initialize and check Google Calendar connection from database
  useEffect(() => {
    fetchTasks();
    checkGoogleConnection();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${BACKEND_URL}/tasks?firebaseId=${TEST_USER.firebaseId}`);
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const data = await res.json();
      const sanitized = Array.isArray(data)
        ? data.map((t: any) => {
          if (t.quadrant !== 'Do' && t.quadrant !== 'Schedule' && t.quadrant !== 'Delegate' && t.quadrant !== 'Delete') {
            console.warn(`Recovered task ${t._id} with invalid quadrant ${t.quadrant}. Resetting to Do.`);
            return { ...t, quadrant: 'Do' };
          }
          return t;
        })
        : [];
      setTasks(sanitized);
      setApiError(null);
    } catch (err: any) {
      console.error(err);
      setApiError('Backend server is offline. Please make sure the Express backend is running on port 5000.');
    } finally {
      setLoading(false);
    }
  };

  const checkGoogleConnection = async () => {
    try {
      // Resolve user status or read connection
      const res = await fetch(`${BACKEND_URL}/calendar/free-busy?firebaseId=${TEST_USER.firebaseId}`);
      if (res.ok) {
        setGoogleConnected(true);
        // We retrieve the token if needed, or just set connection state
        // For security backend holds the token, but we track UI status
      }
    } catch (err) {
      console.error('Failed to fetch calendar status:', err);
    }
  };

  const saveGoogleToken = async (token: string | null) => {
    try {
      setLoading(true);
      if (token) {
        const res = await fetch(`${BACKEND_URL}/calendar/connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firebaseId: TEST_USER.firebaseId,
            googleAccessToken: token
          })
        });
        if (res.ok) {
          setGoogleConnected(true);
          setGoogleAccessToken(token);
          setApiError(null);
        } else {
          throw new Error('Failed to connect Google account on backend.');
        }
      } else {
        const res = await fetch(`${BACKEND_URL}/calendar/disconnect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firebaseId: TEST_USER.firebaseId
          })
        });
        if (res.ok) {
          setGoogleConnected(false);
          setGoogleAccessToken(null);
        }
      }
    } catch (err: any) {
      console.error(err);
      setApiError(err.message || 'Failed to update Google token.');
    } finally {
      setLoading(false);
    }
  };

  const handleStatsChange = (stats: { energyLevel: number; sleepHours: number; dailyWinsCount: number }) => {
    const energyScore = (stats.energyLevel / 5) * 50;
    const sleepScore = Math.min(stats.sleepHours / 8, 1) * 40;
    const winsScore = Math.min(stats.dailyWinsCount / 5, 1) * 10;
    const score = Math.round(energyScore + sleepScore + winsScore);
    setLocalScore(score);
  };

  return (
    <AppContext.Provider
      value={{
        tasks,
        setTasks,
        activePlan,
        setActivePlan,
        readinessScore,
        setReadinessScore,
        localScore,
        setLocalScore,
        flashingQuadrants,
        setFlashingQuadrants,
        loading,
        setLoading,
        apiError,
        setApiError,
        googleConnected,
        setGoogleConnected,
        googleAccessToken,
        saveGoogleToken,
        fetchTasks,
        handleStatsChange
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
