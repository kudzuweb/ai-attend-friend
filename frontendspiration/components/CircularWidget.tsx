import React, { useState, useEffect } from 'react';
import { SessionState, SessionStatus } from '../types';

interface CircularWidgetProps {
  sessionState: SessionState;
  onTogglePause: () => void;
  onStop: () => void;
  onOpenPanel: () => void;
}

const CircularWidget: React.FC<CircularWidgetProps> = ({ 
  sessionState, 
  onTogglePause, 
  onStop,
  onOpenPanel
}) => {
  const [hovered, setHovered] = useState(false);
  const size = 220;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  // Calculate progress
  const progress = sessionState.durationMs > 0 
    ? (sessionState.remainingMs / sessionState.durationMs) 
    : 0;
  
  const strokeDashoffset = circumference - progress * circumference;

  // Format time
  const formatTime = (ms: number) => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getStatusColor = () => {
    switch (sessionState.status) {
      case SessionStatus.RUNNING: return 'stroke-indigo-500';
      case SessionStatus.PAUSED: return 'stroke-amber-400';
      case SessionStatus.COMPLETED: return 'stroke-emerald-500';
      default: return 'stroke-slate-300';
    }
  };

  const getStatusText = () => {
    if (sessionState.status === SessionStatus.IDLE) return "Ready";
    if (sessionState.status === SessionStatus.COMPLETED) return "Done!";
    return formatTime(sessionState.remainingMs);
  };

  return (
    <div 
      className="relative flex items-center justify-center select-none"
      style={{ width: size, height: size }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Background Circle (Glassmorphism base) */}
      <div className="absolute inset-0 rounded-full bg-white/80 backdrop-blur-md shadow-2xl border border-white/50" />

      {/* SVG Progress Ring */}
      <svg
        className="absolute inset-0 transform -rotate-90"
        width={size}
        height={size}
      >
        {/* Track */}
        <circle
          className="stroke-slate-100"
          strokeWidth={strokeWidth}
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        {/* Progress */}
        <circle
          className={`${getStatusColor()} transition-all duration-500 ease-in-out drop-shadow-lg`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: strokeDashoffset,
          }}
        />
      </svg>

      {/* Center Content */}
      <div className="z-10 flex flex-col items-center justify-center text-slate-700">
        
        {/* State: IDLE - Show Start Button implicitly via "Ready" */}
        {sessionState.status === SessionStatus.IDLE && (
           <button 
             onClick={onOpenPanel}
             className="flex flex-col items-center group cursor-pointer"
           >
             <span className="text-4xl mb-1">🌱</span>
             <span className="text-xl font-bold text-slate-600 group-hover:text-indigo-600 transition-colors">Start</span>
           </button>
        )}

        {/* State: ACTIVE/PAUSED - Show Timer or Controls on Hover */}
        {sessionState.status !== SessionStatus.IDLE && (
          <>
            <div className={`transition-opacity duration-300 absolute inset-0 flex flex-col items-center justify-center ${hovered ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
              <span className="text-5xl font-bold tracking-tight text-slate-800 font-mono">
                {getStatusText()}
              </span>
              <span className="text-xs uppercase tracking-widest text-slate-400 mt-2 font-semibold">
                {sessionState.status}
              </span>
            </div>

            {/* Controls Overlay */}
            <div className={`transition-all duration-300 absolute inset-0 flex items-center justify-center gap-4 ${hovered ? 'opacity-100 scale-100' : 'opacity-0 scale-110 pointer-events-none'}`}>
               
               {/* Pause/Resume */}
               <button 
                onClick={onTogglePause}
                className="w-12 h-12 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-sm transition-transform hover:scale-110 active:scale-95"
                title={sessionState.status === SessionStatus.PAUSED ? "Resume" : "Pause"}
               >
                 {sessionState.status === SessionStatus.PAUSED ? (
                   <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                 ) : (
                   <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                 )}
               </button>

               {/* Stop */}
               <button 
                onClick={onStop}
                className="w-12 h-12 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-500 flex items-center justify-center shadow-sm transition-transform hover:scale-110 active:scale-95"
                title="End Session"
               >
                 <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>
               </button>
            </div>
          </>
        )}
      </div>
      
      {/* Draggable Area Indication (Visual only) */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-8 h-1 bg-slate-200 rounded-full opacity-50" />
    </div>
  );
};

export default CircularWidget;