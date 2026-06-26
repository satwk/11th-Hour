import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, RotateCcw, X, Check } from 'lucide-react';

interface Task {
  _id: string;
  title: string;
  quadrant: 'Do' | 'Schedule' | 'Delegate' | 'Delete';
  cognitiveLoad: 'Low' | 'Medium' | 'High';
  estimatedDuration: number;
  status: 'Not Started' | 'In Progress' | 'Completed';
  externallyDependent: boolean;
}

interface FocusModeProps {
  task: Task | null;
  onClose: () => void;
  onComplete: (id: string) => void;
}

export const FocusMode: React.FC<FocusModeProps> = ({ task, onClose, onComplete }) => {
  if (!task) return null;

  const [timeLeft, setTimeLeft] = useState<number>(task.estimatedDuration * 60);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  useEffect(() => {
    let interval: any = null;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsRunning(false);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, timeLeft]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    setIsRunning(false);
    setTimeLeft(task.estimatedDuration * 60);
  };

  const handleComplete = () => {
    setIsRunning(false);
    onComplete(task._id);
    onClose();
  };

  const progress = 1 - (timeLeft / (task.estimatedDuration * 60));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0c0d0e]/98 backdrop-blur-md p-6 text-[#f7f8f8]"
    >
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-6 right-6 p-2.5 rounded-full bg-[#0f1011] hover:bg-[#141516] border border-[#222326] text-[#f7f8f8] transition-colors cursor-pointer"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Main Focus Container */}
      <div className="max-w-2xl w-full flex flex-col items-center text-center space-y-8">
        <span className="text-[10px] uppercase tracking-widest font-semibold text-[#5e6ad2] bg-[#5e6ad2]/10 border border-[#5e6ad2]/20 px-3.5 py-1.5 rounded-full">
          Focus Session
        </span>

        {/* Task Title with display layout */}
        <h1 className="text-3xl md:text-5xl font-semibold text-[#f7f8f8] tracking-tight leading-tight px-4 max-w-2xl font-display">
          {task.title}
        </h1>

        {/* Time display */}
        <div className="relative w-72 h-72 flex items-center justify-center">
          {/* Progress circle */}
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="144"
              cy="144"
              r="120"
              className="stroke-[#222326]"
              strokeWidth="4"
              fill="transparent"
            />
            <circle
              cx="144"
              cy="144"
              r="120"
              className="stroke-[#5e6ad2] transition-all duration-300"
              strokeWidth="6"
              fill="transparent"
              strokeDasharray={754}
              strokeDashoffset={754 - 754 * progress}
            />
          </svg>
          {/* Digits */}
          <div className="absolute text-5xl font-bold font-mono text-[#f7f8f8]">
            {formatTime(timeLeft)}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-6">
          {/* Reset */}
          <button
            type="button"
            onClick={handleReset}
            className="p-3.5 rounded-full bg-[#0f1011] hover:bg-[#141516] border border-[#222326] text-[#f7f8f8] transition-all hover:scale-105 cursor-pointer"
            title="Reset Timer"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          {/* Play / Pause */}
          <button
            type="button"
            onClick={handlePlayPause}
            className="p-5 rounded-full bg-[#5e6ad2] hover:bg-[#828fff] text-white transition-all hover:scale-105 shadow-md hover:shadow-lg cursor-pointer animate-pulse-subtle"
            title={isRunning ? 'Pause' : 'Start'}
          >
            {isRunning ? <Pause className="w-7 h-7 fill-white stroke-none" /> : <Play className="w-7 h-7 fill-white stroke-none ml-1" />}
          </button>

          {/* Done */}
          <button
            type="button"
            onClick={handleComplete}
            className="p-3.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white transition-all hover:scale-105 shadow-md cursor-pointer"
            title="Complete Task"
          >
            <Check className="w-5 h-5 stroke-[3]" />
          </button>
        </div>

        <p className="text-xs text-[#8a8f98] pt-4 font-mono">
          Estimated: {task.estimatedDuration}m · Quadrant: {task.quadrant}
        </p>
      </div>
    </motion.div>
  );
};
export default FocusMode;
