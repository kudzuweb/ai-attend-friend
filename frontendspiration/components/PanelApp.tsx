
import React, { useState, useRef, useEffect } from 'react';
import { Task, SessionState, SessionStatus, Loop, Reflection } from '../types';

interface PanelAppProps {
  sessionState: SessionState;
  tasks: Task[];
  activeTaskId: string | null;
  loops: Loop[];
  reflections: Reflection[];
  onAddTask: (title: string) => void;
  onUpdateTask: (id: string, title: string) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onSetActiveTask: (id: string) => void;
  onIndentTask: (id: string) => void;
  onOutdentTask: (id: string) => void;
  onAddLoop: (content: string) => void;
  onDeleteLoop: (id: string) => void;
  onAddReflection: (content: string) => void;
  onStartSession: (duration: number, focusGoal: string) => void;
  onPauseSession: () => void;
  onStopSession: () => void;
  onClose: () => void;
}

const TaskItem: React.FC<{
    task: Task;
    activeTaskId: string | null;
    depth?: number;
    onToggle: (id: string) => void;
    onDelete: (id: string) => void;
    onSetActive: (id: string) => void;
    onUpdate: (id: string, title: string) => void;
    onIndent: (id: string) => void;
    onOutdent: (id: string) => void;
}> = ({ task, activeTaskId, depth = 0, onToggle, onDelete, onSetActive, onUpdate, onIndent, onOutdent }) => {
    const inputRef = useRef<HTMLInputElement>(null);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            if (e.shiftKey) {
                onOutdent(task.id);
            } else {
                onIndent(task.id);
            }
        }
    };

    return (
        <div className="flex flex-col">
            <div 
                onClick={() => onSetActive(task.id)}
                className={`group flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                    activeTaskId === task.id 
                        ? 'bg-[#FEF2F2] border-[#FEE2E2] shadow-sm' 
                        : 'bg-white border-transparent hover:border-gray-100 hover:bg-gray-50'
                }`}
                style={{ marginLeft: `${depth * 24}px` }}
            >
                {/* Drag Handle (Visual) */}
                <div className="text-gray-300 opacity-0 group-hover:opacity-100 cursor-grab flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>
                </div>

                <button 
                    onClick={(e) => { e.stopPropagation(); onToggle(task.id); }}
                    className={`w-5 h-5 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${
                        task.completed ? 'bg-[#3E322C] border-[#3E322C] text-white' : 'border-gray-300 bg-white hover:border-[#D87561]'
                    }`}
                >
                    {task.completed && <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                </button>

                <input
                    ref={inputRef}
                    type="text"
                    value={task.title}
                    onChange={(e) => onUpdate(task.id, e.target.value)}
                    onKeyDown={handleKeyDown}
                    className={`flex-1 bg-transparent outline-none text-base font-elegant ${task.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}
                />

                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {activeTaskId === task.id && (
                            <span className="text-xs font-bold text-[#D87561] bg-[#D87561]/10 px-2 py-1 rounded font-elegant">Active</span>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); onDelete(task.id); }} className="text-gray-400 hover:text-rose-500 p-1">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                </div>
            </div>
            
            {/* Render Subtasks */}
            {task.subtasks?.map(subtask => (
                <TaskItem
                    key={subtask.id}
                    task={subtask}
                    activeTaskId={activeTaskId}
                    depth={depth + 1}
                    onToggle={onToggle}
                    onDelete={onDelete}
                    onSetActive={onSetActive}
                    onUpdate={onUpdate}
                    onIndent={onIndent}
                    onOutdent={onOutdent}
                />
            ))}
        </div>
    );
};

const PanelApp: React.FC<PanelAppProps> = ({
  sessionState,
  tasks,
  activeTaskId,
  loops,
  reflections,
  onAddTask,
  onUpdateTask,
  onToggleTask,
  onDeleteTask,
  onSetActiveTask,
  onIndentTask,
  onOutdentTask,
  onAddLoop,
  onDeleteLoop,
  onAddReflection,
  onStartSession,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'focus' | 'loops' | 'journal'>('focus');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newLoopContent, setNewLoopContent] = useState('');
  const [newReflectionContent, setNewReflectionContent] = useState('');
  
  const handleAddTaskSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (newTaskTitle.trim()) {
          onAddTask(newTaskTitle);
          setNewTaskTitle('');
      }
  };

  const handleAddLoopSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newLoopContent.trim()) {
      onAddLoop(newLoopContent);
      setNewLoopContent('');
    }
  };

  const handleAddReflectionSubmit = () => {
    if (newReflectionContent.trim()) {
      onAddReflection(newReflectionContent);
      setNewReflectionContent('');
    }
  };

  return (
    <div className="flex w-[900px] h-[600px] bg-[#F9F8F6] rounded-xl overflow-hidden shadow-2xl font-sans">
      {/* Sidebar */}
      <div className="w-72 bg-[#3E322C] text-white flex flex-col p-8 font-elegant">
        <div className="flex justify-center mb-16">
          <h1 className="text-5xl font-serif tracking-tight">Attend</h1>
        </div>
        
        <nav className="flex flex-col gap-6">
          <button 
            onClick={() => setActiveTab('focus')}
            className={`flex items-center gap-4 text-xl font-medium transition-all duration-200 ${activeTab === 'focus' ? 'text-white translate-x-2' : 'text-white/50 hover:text-white'}`}
          >
             <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${activeTab === 'focus' ? 'border-[#D87561] text-[#D87561]' : 'border-current'}`}>
                 <div className="w-2 h-2 rounded-full bg-current" />
             </div>
            Focus
          </button>

          <button 
            onClick={() => setActiveTab('loops')}
            className={`flex items-center gap-4 text-xl font-medium transition-all duration-200 ${activeTab === 'loops' ? 'text-white translate-x-2' : 'text-white/50 hover:text-white'}`}
          >
            {/* Inbox / Open Loops Icon */}
            <svg className={`w-6 h-6 ${activeTab === 'loops' ? 'text-[#D87561]' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            Open Loops
          </button>

           <button 
            onClick={() => setActiveTab('journal')}
            className={`flex items-center gap-4 text-xl font-medium transition-all duration-200 ${activeTab === 'journal' ? 'text-white translate-x-2' : 'text-white/50 hover:text-white'}`}
          >
            {/* Journal Icon (Book Open) */}
            <svg className={`w-6 h-6 ${activeTab === 'journal' ? 'text-[#D87561]' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Reflections
          </button>
        </nav>

        <div className="mt-auto">
            <button onClick={onClose} className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm font-medium tracking-wide">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
                Back to Widget
            </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col p-10 overflow-hidden bg-[#F9F8F6]">
        
        {/* --- VIEW: FOCUS (DEFAULT) --- */}
        {activeTab === 'focus' && (
          <>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-4xl font-serif text-[#3E322C]">Focus</h2>
              <div className="flex gap-4">
                  <button 
                    onClick={() => onStartSession(25, "Just start")}
                    className="px-6 py-2 bg-[#D87561] text-white rounded-lg font-medium font-elegant hover:bg-[#3E322C] transition-colors shadow-sm flex items-center gap-2"
                  >
                    <span>Start Session</span>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </button>
              </div>
            </div>

            <div className="flex gap-8 h-full overflow-hidden">
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-serif text-[#3E322C]">My Tasks</h3>
                        <div className="flex gap-2">
                            <button className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg>
                            </button>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-2 shadow-sm border border-gray-100 flex-1 flex flex-col overflow-hidden">
                        <form onSubmit={handleAddTaskSubmit} className="p-2 border-b border-gray-100 flex gap-2">
                            <input 
                                type="text" 
                                placeholder="Add a new task..." 
                                className="flex-1 bg-gray-50 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D87561]/20 font-elegant"
                                value={newTaskTitle}
                                onChange={(e) => setNewTaskTitle(e.target.value)}
                            />
                            <button type="submit" className="px-4 py-2 bg-[#D87561] text-white rounded-lg text-sm font-medium hover:bg-[#3E322C] transition-colors font-elegant">
                                Add
                            </button>
                        </form>

                        <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                            {tasks.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm italic">
                                    No tasks yet. Add one to get started!
                                </div>
                            ) : (
                                tasks.map(task => (
                                    <TaskItem 
                                        key={task.id} 
                                        task={task} 
                                        activeTaskId={activeTaskId} 
                                        onToggle={onToggleTask}
                                        onDelete={onDeleteTask}
                                        onSetActive={onSetActiveTask}
                                        onUpdate={onUpdateTask}
                                        onIndent={onIndentTask}
                                        onOutdent={onOutdentTask}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                </div>
                <div className="w-1/6 hidden lg:block"></div>
            </div>
          </>
        )}

        {/* --- VIEW: OPEN LOOPS --- */}
        {activeTab === 'loops' && (
           <>
            <div className="flex flex-col mb-8">
              <h2 className="text-4xl font-serif text-[#3E322C] mb-2">Open Loops</h2>
              <p className="text-[#3E322C]/60 font-elegant">Capture unfinished tasks, ideas, and fleeting thoughts.</p>
            </div>

            <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
               <form onSubmit={handleAddLoopSubmit} className="p-4 border-b border-gray-100 bg-gray-50/50 flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400">
                     <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  </div>
                  <input 
                      type="text" 
                      placeholder="What's on your mind? Press Enter to capture." 
                      className="flex-1 bg-transparent text-lg font-elegant outline-none placeholder:text-gray-300 text-[#3E322C]"
                      value={newLoopContent}
                      onChange={(e) => setNewLoopContent(e.target.value)}
                      autoFocus
                  />
               </form>

               <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                  {loops.length === 0 ? (
                     <div className="h-full flex flex-col items-center justify-center text-gray-300">
                        <svg className="w-16 h-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                        <p className="font-elegant">All loops closed. Mind is clear.</p>
                     </div>
                  ) : (
                    <div className="space-y-3">
                       {loops.map(loop => (
                          <div key={loop.id} className="group flex items-start gap-3 p-4 bg-white border border-gray-100 rounded-lg hover:shadow-md transition-all">
                             <div className="mt-1 w-2 h-2 rounded-full bg-[#D87561]" />
                             <div className="flex-1">
                                <p className="text-[#3E322C] font-elegant text-lg leading-relaxed">{loop.content}</p>
                                <span className="text-xs text-gray-400 mt-1 block">Captured {new Date(loop.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                             </div>
                             <button 
                                onClick={() => onDeleteLoop(loop.id)}
                                className="opacity-0 group-hover:opacity-100 p-2 text-gray-300 hover:text-rose-500 transition-all"
                                title="Delete / Close Loop"
                             >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                             </button>
                          </div>
                       ))}
                    </div>
                  )}
               </div>
            </div>
           </>
        )}

        {/* --- VIEW: REFLECTIONS --- */}
        {activeTab === 'journal' && (
          <>
             <div className="flex flex-col mb-6">
              <h2 className="text-4xl font-serif text-[#3E322C] mb-2">Reflections</h2>
              <p className="text-[#3E322C]/60 font-elegant">Review your session logs and insights.</p>
            </div>

            <div className="flex gap-8 h-full overflow-hidden">
                {/* Editor Side */}
                <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                   <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-400 font-elegant uppercase tracking-wider">New Entry</span>
                      <span className="text-sm text-gray-400 font-serif italic">{new Date().toLocaleDateString()}</span>
                   </div>
                   <textarea 
                      className="flex-1 p-6 resize-none outline-none font-serif text-xl leading-relaxed text-[#3E322C] placeholder:text-gray-200"
                      placeholder="How did your session go? What did you learn?"
                      value={newReflectionContent}
                      onChange={(e) => setNewReflectionContent(e.target.value)}
                   />
                   <div className="p-4 border-t border-gray-100 flex justify-end">
                      <button 
                        onClick={handleAddReflectionSubmit}
                        disabled={!newReflectionContent.trim()}
                        className="px-6 py-2 bg-[#3E322C] text-white rounded-lg font-medium font-elegant hover:bg-[#D87561] disabled:opacity-50 disabled:hover:bg-[#3E322C] transition-colors"
                      >
                         Save Reflection
                      </button>
                   </div>
                </div>

                {/* History Side */}
                <div className="w-1/3 flex flex-col bg-[#F9F8F6] border-l border-gray-200/50 pl-8 overflow-y-auto custom-scrollbar">
                   <h3 className="text-xl font-serif text-[#3E322C] mb-6 sticky top-0 bg-[#F9F8F6] py-2">History</h3>
                   <div className="space-y-8 relative">
                      {/* Timeline Line */}
                      <div className="absolute left-[5px] top-2 bottom-0 w-[1px] bg-gray-200" />
                      
                      {reflections.map(reflection => (
                         <div key={reflection.id} className="relative pl-6">
                            {/* Dot */}
                            <div className="absolute left-0 top-2 w-3 h-3 rounded-full border-2 border-[#D87561] bg-[#F9F8F6] z-10" />
                            
                            <div className="mb-1">
                               <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                                  {new Date(reflection.createdAt).toLocaleDateString()}
                               </span>
                            </div>
                            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                               <p className="text-[#3E322C] font-serif text-sm leading-relaxed opacity-80 line-clamp-4">
                                  {reflection.content}
                                </p>
                            </div>
                         </div>
                      ))}
                   </div>
                </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
};

export default PanelApp;
