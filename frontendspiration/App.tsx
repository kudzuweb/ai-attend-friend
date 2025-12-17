
import React, { useState, useEffect } from 'react';
import { SessionState, SessionStatus, Task, Loop, Reflection } from './types';
import PersistentWidget from './components/PersistentWidget';
import PanelApp from './components/PanelApp';

const App: React.FC = () => {
  // Navigation State
  const [view, setView] = useState<'widget' | 'panel'>('widget');

  // Global Session State
  const [session, setSession] = useState<SessionState>({
    status: SessionStatus.IDLE,
    startTime: null,
    durationMs: 0,
    remainingMs: 0,
    focusGoal: ''
  });

  // Global Task State
  const [tasks, setTasks] = useState<Task[]>([
    { id: '1', title: 'Talk with Mauria', completed: false, priority: 'high' },
    { id: '2', title: 'Review PR #402', completed: false, priority: 'medium' },
    { id: '3', title: 'Draft documentation', completed: true, priority: 'low' },
  ]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>('1');

  // Open Loops State
  const [loops, setLoops] = useState<Loop[]>([
    { id: 'l1', content: 'Email Sarah about the roadmap', createdAt: Date.now() - 100000 },
    { id: 'l2', content: 'Buy coffee filters', createdAt: Date.now() - 200000 },
  ]);

  // Reflections State
  const [reflections, setReflections] = useState<Reflection[]>([
    { id: 'r1', content: 'Felt really productive in the morning, but hit a slump around 2pm. Need to take better breaks.', createdAt: Date.now() - 86400000 },
  ]);

  // Helper functions for recursive task updates
  const updateTaskRecursive = (list: Task[], id: string, updateFn: (t: Task) => Task): Task[] => {
    return list.map(t => {
      if (t.id === id) return updateFn(t);
      if (t.subtasks) return { ...t, subtasks: updateTaskRecursive(t.subtasks, id, updateFn) };
      return t;
    });
  };

  const deleteTaskRecursive = (list: Task[], id: string): Task[] => {
    return list
      .filter(t => t.id !== id)
      .map(t => ({
        ...t,
        subtasks: t.subtasks ? deleteTaskRecursive(t.subtasks, id) : undefined
      }));
  };

  // Derived state
  const findTaskRecursive = (list: Task[], id: string): Task | undefined => {
    for (const t of list) {
      if (t.id === id) return t;
      if (t.subtasks) {
        const found = findTaskRecursive(t.subtasks, id);
        if (found) return found;
      }
    }
    return undefined;
  };

  const activeTask = activeTaskId ? findTaskRecursive(tasks, activeTaskId) : undefined;

  // Task Handlers
  const handleAddTask = (title: string) => {
    const newTask: Task = {
      id: Date.now().toString(),
      title,
      completed: false,
      priority: 'medium'
    };
    setTasks([newTask, ...tasks]);
    if (!activeTaskId) setActiveTaskId(newTask.id);
  };

  const handleToggleTask = (id: string) => {
    setTasks(prev => updateTaskRecursive(prev, id, t => ({ ...t, completed: !t.completed })));
  };

  const handleDeleteTask = (id: string) => {
    setTasks(prev => deleteTaskRecursive(prev, id));
    if (activeTaskId === id) setActiveTaskId(null);
  };

  const handleUpdateTask = (id: string, title: string) => {
    setTasks(prev => updateTaskRecursive(prev, id, t => ({ ...t, title })));
  };

  const handleSetActiveTask = (id: string) => {
    setActiveTaskId(id);
  };

  const handleIndentTask = (id: string) => {
    console.log("Indent task", id);
  };

  const handleOutdentTask = (id: string) => {
    console.log("Outdent task", id);
  };

  // Loop Handlers
  const handleAddLoop = (content: string) => {
    setLoops([{ id: Date.now().toString(), content, createdAt: Date.now() }, ...loops]);
  };

  const handleDeleteLoop = (id: string) => {
    setLoops(prev => prev.filter(l => l.id !== id));
  };

  // Reflection Handlers
  const handleAddReflection = (content: string) => {
    setReflections([{ id: Date.now().toString(), content, createdAt: Date.now() }, ...reflections]);
  };

  // Timer Logic
  useEffect(() => {
    let interval: number;
    if (session.status === SessionStatus.RUNNING && session.remainingMs > 0) {
      interval = window.setInterval(() => {
        setSession(prev => {
          if (prev.remainingMs <= 1000) {
            return { ...prev, status: SessionStatus.COMPLETED, remainingMs: 0 };
          }
          return { ...prev, remainingMs: prev.remainingMs - 1000 };
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [session.status, session.remainingMs]);

  // Session Handlers
  const handleStartSession = (durationMinutes: number, focusGoal: string) => {
    const durationMs = durationMinutes * 60 * 1000;
    setSession({
      status: SessionStatus.RUNNING,
      startTime: Date.now(),
      durationMs: durationMs,
      remainingMs: durationMs,
      focusGoal
    });
    // Switch to widget view when starting
    setView('widget'); 
  };

  const handleTogglePause = () => {
    if (session.status === SessionStatus.IDLE) return;
    setSession(prev => ({
      ...prev,
      status: prev.status === SessionStatus.RUNNING ? SessionStatus.PAUSED : SessionStatus.RUNNING
    }));
  };

  const handleStop = () => {
    setSession({
      status: SessionStatus.IDLE,
      startTime: null,
      durationMs: 0,
      remainingMs: 0,
      focusGoal: ''
    });
  };

  // Demo: Hash-based routing
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'panel') setView('panel');
      else setView('widget');
    };
    window.addEventListener('hashchange', handleHashChange);
    if (window.location.hash === '#panel') setView('panel');
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const switchView = (newView: 'widget' | 'panel') => {
    window.location.hash = newView;
    setView(newView);
  };

  return (
    <>
      <div className="flex gap-10 items-start">
        {view === 'widget' && (
          <PersistentWidget 
            sessionState={session}
            activeTask={activeTask}
            onTogglePause={handleTogglePause}
            onStop={handleStop}
            onOpenPanel={() => switchView('panel')}
          />
        )}

        {view === 'panel' && (
          <PanelApp 
            sessionState={session}
            tasks={tasks}
            activeTaskId={activeTaskId}
            loops={loops}
            reflections={reflections}
            onAddTask={handleAddTask}
            onUpdateTask={handleUpdateTask}
            onToggleTask={handleToggleTask}
            onDeleteTask={handleDeleteTask}
            onSetActiveTask={handleSetActiveTask}
            onIndentTask={handleIndentTask}
            onOutdentTask={handleOutdentTask}
            onAddLoop={handleAddLoop}
            onDeleteLoop={handleDeleteLoop}
            onAddReflection={handleAddReflection}
            onStartSession={handleStartSession}
            onPauseSession={handleTogglePause}
            onStopSession={handleStop}
            onClose={() => switchView('widget')}
          />
        )}
      </div>

      {/* Demo Controls */}
      <div className="fixed bottom-4 right-4 bg-slate-800 text-white p-4 rounded-lg text-xs opacity-50 hover:opacity-100 transition-opacity font-sans z-50">
        <p className="font-bold mb-2">Demo Controls</p>
        <div className="flex gap-2">
          <button onClick={() => switchView('widget')} className="px-2 py-1 bg-slate-700 rounded hover:bg-slate-600">Show Widget</button>
          <button onClick={() => switchView('panel')} className="px-2 py-1 bg-slate-700 rounded hover:bg-slate-600">Show Panel</button>
        </div>
      </div>
    </>
  );
};

export default App;
