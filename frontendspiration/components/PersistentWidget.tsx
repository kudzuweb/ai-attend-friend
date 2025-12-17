import React, { useState } from 'react';
import { SessionState, SessionStatus, Task } from '../types';

interface PersistentWidgetProps {
  sessionState: SessionState;
  activeTask: Task | undefined;
  onTogglePause: () => void;
  onStop: () => void;
  onOpenPanel: () => void;
}

const PersistentWidget: React.FC<PersistentWidgetProps> = ({ 
  sessionState, 
  activeTask,
  onTogglePause, 
  onStop,
  onOpenPanel
}) => {
  const [hovered, setHovered] = useState(false);
  const [minimalMode, setMinimalMode] = useState(false);

  // Format time
  const formatTime = (ms: number) => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const isRunning = sessionState.status === SessionStatus.RUNNING;
  const isPaused = sessionState.status === SessionStatus.PAUSED;
  const isIdle = sessionState.status === SessionStatus.IDLE;

  // --- VIEW 1: NEUTRAL / IDLE ---
  if (isIdle) {
    return (
      <div 
        className="relative flex flex-col w-[340px] h-[260px] bg-[#F9F8F6] rounded-[2rem] shadow-xl p-6 select-none overflow-hidden font-sans transition-transform hover:-translate-y-1"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-4xl">
             🌱
          </div>
          <h2 className="text-2xl font-serif text-[#3E322C] mb-1">Ready to Flow?</h2>
          <p className="text-[#3E322C]/60 text-sm">No active session</p>
        </div>

        <div className="mt-auto">
          <button 
            onClick={onOpenPanel}
            className="w-full py-3 bg-[#D87561] text-white rounded-xl font-medium hover:bg-[#3E322C] transition-colors flex items-center justify-center gap-2"
          >
            <span>Start Session</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          </button>
        </div>
      </div>
    );
  }

  // --- VIEW 2: IN-SESSION (MINIMAL TIMER ONLY) ---
  if (minimalMode) {
    return (
      <div 
        className="relative flex flex-col w-[340px] h-[260px] bg-[#3E322C] rounded-[2rem] shadow-xl p-6 select-none overflow-hidden font-sans transition-transform hover:-translate-y-1 text-white"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Toggle Back Button */}
        <button 
          onClick={() => setMinimalMode(false)}
          className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
        </button>

        <div className="flex-1 flex flex-col items-center justify-center">
           <span className="text-[5rem] font-serif font-bold leading-none tracking-tighter tabular-nums">
             {formatTime(sessionState.remainingMs)}
           </span>
           <p className="text-white/60 mt-2 font-serif italic text-lg">
             {activeTask ? activeTask.title : "Focusing..."}
           </p>
        </div>

        <div className="flex items-center justify-center gap-6 mt-4">
           <button 
             onClick={onTogglePause}
             className="w-14 h-14 rounded-full bg-[#D87561] text-white flex items-center justify-center hover:bg-[#3E322C] active:scale-95 transition-all shadow-lg"
           >
             {isPaused ? (
                <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
             ) : (
                <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
             )}
           </button>
           
           <button 
             onClick={onStop}
             className="w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all"
           >
             <div className="w-4 h-4 bg-current rounded-sm" />
           </button>
        </div>
      </div>
    );
  }

  // --- VIEW 3: IN-SESSION (TASK VIEW - DEFAULT) ---
  return (
    <div 
      className="relative flex flex-col w-[340px] h-[260px] bg-[#F9F8F6] rounded-[2rem] shadow-xl p-5 select-none overflow-hidden font-sans transition-transform hover:-translate-y-1"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Top Row: Pause & Timer */}
      <div className="flex items-center justify-between mb-6">
        <button 
          onClick={onTogglePause}
          className="w-10 h-10 rounded-full flex items-center justify-center text-white transition-all active:scale-95 shadow-md bg-[#D87561] hover:bg-[#3E322C]"
        >
          {isPaused ? (
             <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          ) : (
             <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          )}
        </button>

        {/* Timer Box - Click to toggle minimal mode */}
        <button 
          onClick={() => setMinimalMode(true)}
          className="px-4 py-1 rounded-lg bg-white shadow-sm hover:shadow-md transition-all group flex items-center gap-2"
          title="Switch to Timer View"
        >
           <span className="text-xl font-serif font-bold text-[#3E322C] tabular-nums">
             {formatTime(sessionState.remainingMs)}
           </span>
           <svg className="w-4 h-4 text-[#3E322C]/50 group-hover:text-[#3E322C]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
        </button>
      </div>

      {/* Middle: Active Task */}
      <div className="flex-1 flex flex-col justify-center mb-2 px-1">
        <div className="flex items-start gap-4">
            <div className={`mt-1 w-6 h-6 border-2 border-[#D87561] rounded flex-shrink-0 flex items-center justify-center ${activeTask?.completed ? 'bg-[#D87561]' : 'bg-transparent'}`}>
                {activeTask?.completed && <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
            </div>
            <div>
                <h3 className="text-xl font-medium leading-tight text-[#3E322C] line-clamp-2">
                    {activeTask ? activeTask.title : <span className="text-[#3E322C]/60 italic">No active task</span>}
                </h3>
            </div>
        </div>
      </div>

      {/* Bottom: Icons */}
      <div className="mt-auto flex items-center justify-between px-2 pt-4 border-t-2 border-slate-100">
        <button onClick={onOpenPanel} className="text-[#3E322C]/40 hover:text-[#3E322C] hover:scale-110 transition-all flex items-center gap-1 font-medium text-sm group">
            <svg className="w-6 h-6 group-hover:text-[#D87561] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            <span className="opacity-0 group-hover:opacity-100 transition-opacity -ml-2 group-hover:ml-0">Add Task</span>
        </button>
        
        <button onClick={onOpenPanel} className="text-[#3E322C]/40 hover:text-[#3E322C] hover:scale-110 transition-all spin-on-hover" title="Settings">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        </button>
      </div>
    </div>
  );
};

export default PersistentWidget;