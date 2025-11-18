# AI-Attend-Friend Codebase Exploration Report

**Date:** 2025-11-14  
**Repository:** ai-attend-friend (Electron + React + TypeScript)

---

## 1. Overall Directory Structure

```
ai-attend-friend/
├── electron/                          # Main Electron process (backend)
│   ├── main.ts                        # App entry point, service initialization
│   ├── preload.js                     # IPC bridge to renderer
│   ├── session-storage.js             # Session data persistence
│   ├── handlers/
│   │   └── IPCHandlers.ts             # IPC message handlers
│   ├── services/
│   │   ├── ConfigService.ts           # Config/settings management
│   │   ├── WindowManager.ts           # Window creation & positioning (346 lines)
│   │   ├── SessionManager.ts          # Session lifecycle & timers (557 lines) **COMPLEX**
│   │   ├── ScreenshotService.ts       # Screenshot capture & storage
│   │   ├── AIAnalysisService.ts       # LLM integration for analysis
│   │   └── StorageService.ts          # Session data storage
│   └── types/
│       └── session.types.ts           # TypeScript types
│
├── src/                               # React frontend (renderer)
│   ├── main.tsx                       # React entry point
│   ├── App.tsx                        # Main app router
│   ├── components/
│   │   ├── WidgetApp.tsx              # Circular widget UI
│   │   ├── PanelApp.tsx               # Panel router/navigation
│   │   ├── widgetshell.tsx            # Widget styling (circular wedges)
│   │   └── panel-views/               # Panel screen views
│   │       ├── SessionSetupView.tsx   # Start session form
│   │       ├── AnalysisView.tsx       # Show analysis results
│   │       ├── DistractedReasonView.tsx
│   │       ├── InterruptionReflectionView.tsx
│   │       ├── DeeperReflectionView.tsx
│   │       ├── SettingsView.tsx
│   │       └── TasksView.tsx
│   ├── contexts/
│   │   ├── SessionContext.tsx         # Session state management
│   │   ├── SettingsContext.tsx        # Settings state management
│   │   └── ThemeContext.tsx           # Theme/styling
│   ├── types/
│   │   ├── preload.d.ts               # Type definitions for window.api
│   │   └── react-css.d.ts
│   └── prompts/                       # LLM prompts
│
├── dist/                              # Built/compiled output
├── public/                            # Static assets
├── package.json                       # Dependencies
├── vite.config.ts                     # Vite build config
├── tsconfig.app.json                  # React TypeScript config
├── tsconfig.node.json                 # Electron TypeScript config
└── .env                               # Environment variables (secrets)
```

---

## 2. Key Services & Their Responsibilities

### A. ConfigService (electron/services/ConfigService.ts)
**Lines:** 93 | **Complexity:** LOW

**Responsibilities:**
- Persist app configuration to `config.json`
- Manage window position preference (`top-left`, `top-center`, `top-right`)
- Manage demo mode flag (affects analysis timer)
- Manage tasks feature toggle

**Key Methods:**
- `getWindowPosition()`, `setWindowPosition()`
- `getDemoMode()`, `setDemoMode()`
- `getTasksEnabled()`, `setTasksEnabled()`
- `getAllSettings()`, `updateSettings()`

**No magic numbers** - just configuration defaults

---

### B. WindowManager (electron/services/WindowManager.ts)
**Lines:** 353 | **Complexity:** MEDIUM-HIGH

**Responsibilities:**
1. Create and manage widget window (circular UI)
2. Create and manage panel window (popup dialog)
3. Position windows intelligently
4. Queue view changes when panel isn't ready
5. Broadcast session state to renderer processes

**Key Magic Numbers:**
- `160` (line 10) - CIRCLE_SIZE (widget diameter)
- `440` (line 11) - PANEL_WIDTH
- `380` (line 12) - PANEL_HEIGHT
- `20` (line 47) - margin from screen edges
- `5` (line 24) - MAX_PENDING_CHANGES (view change queue limit)

**Key Methods:**
- `createWidgetWindow()` - Creates circular widget
- `showPanel()` - Creates & shows panel with IPC listeners
- `changeView(payload)` - Queue or send view changes
- `setWindowPosition()` - Update widget position based on user preference
- `broadcastSessionState()` - Send state to both windows

**Architecture Issue:**
- Lines 214-230: View change queueing logic should be extracted to `ViewChangeQueue` service
- Holds stale window references without `isDestroyed()` checks

---

### C. SessionManager (electron/services/SessionManager.ts)
**Lines:** 564 | **Complexity:** HIGH ⚠️

**Responsibilities (Too Many!):**
1. Session lifecycle (start, stop, pause, resume)
2. Timer orchestration (3 separate timers)
3. AI analysis triggering
4. Power monitoring coordination
5. Screenshot triggering via IPC
6. Interruption tracking
7. Reflection saving
8. Distraction analysis

**Key Magic Numbers:**
- `30_000` (lines 176, 410) - Screenshot interval (30 seconds)
  - Line 162-177: Initial delay before first screenshot
  - Line 170-176: Recurring interval
  - Line 410: Resume timer uses same interval
- `5 * 60 * 1000` (line 292) - Analysis timer interval (5 minutes)

**Key Methods:**
- `startSession(lengthMs, focusGoal, tasks?)` - Start new session
- `stopSession()` - Stop session, generate summary
- `pauseSession()` - Called on system sleep/lock
- `resumeAfterInterruption(reflection)` - Resume from pause
- `startAnalysisTimer()` - Start 5-minute auto-analysis (respects demo mode)
- `handleDistractionAnalysis(limit?)` - Run distraction analysis
- `setupPowerMonitoring()` - Listen to suspend/resume/lock events

**Critical Issues:**
- **Temporal Coupling:** Timer cleanup order (lines 237-242) has undocumented dependencies
- **SRP Violation:** Handles 7+ different responsibilities
- **Race Conditions:** Analysis timer can fire during cleanup
- **Hidden State:** `remainingSessionTime` only set by `pauseSession()`

**Recommended Refactoring:**
Split into:
- `SessionManager` - just state & lifecycle
- `SessionTimerOrchestrator` - timer coordination
- `PowerMonitorService` - power events

---

### D. ScreenshotService (electron/services/ScreenshotService.ts)
**Lines:** 208 | **Complexity:** LOW-MEDIUM

**Responsibilities:**
- Capture screenshots via DesktopCapturer
- Save screenshots to disk (deduplication by hash)
- Get recent screenshot files
- Convert files to base64 data URLs
- Delete session screenshots

**Key Magic Numbers:**
- `30_000` (line 186) - First screenshot delay (30 seconds)
- `5000` (line 162) - Buffer time for cleanup (5 seconds after session end)

**Key Methods:**
- `saveScreenshot(dataUrl, capturedAt)` - Save to disk with SHA hash
- `getRecentScreenshots(limit = 10)` - Get N most recent
- `fileToDataUrl(file)` - Convert file to base64
- `deleteSessionScreenshots(startTime, endTime)` - Cleanup after session

**Note:** Doesn't actually capture - it saves data already captured by renderer

---

### E. AIAnalysisService (electron/services/AIAnalysisService.ts)
**Lines:** ~300+ | **Complexity:** MEDIUM

**Responsibilities:**
- Load LLM prompts from files
- Analyze recent screenshots for distraction
- Generate session summaries
- Call Claude API

**Key Methods:**
- `initialize()` - Load prompt templates
- `analyzeScreenshots(dataUrls, focusGoal)` - Detect if user is distracted
- `generateFinalSummary(...)` - Create AI-generated session summary

---

### F. StorageService (electron/services/StorageService.ts)
**Lines:** ~200+ | **Complexity:** MEDIUM

**Responsibilities:**
- Create session directories
- Save session metadata
- Store screenshots, reflections, interruptions, distractions
- Load sessions for analysis

**Key Methods:**
- `createSession(startTime, lengthMs, focusGoal, tasks?)` - Create session file
- `addSummaryToSession()` - Append analysis result
- `addReflectionToSession()` - Save user reflection
- `addInterruptionToSession()` - Track sleep/wake event
- `setFinalSummary()` - Save final AI summary

---

## 3. All Magic Numbers & Their Usage

### Screenshot/Timing Constants

| Value | Type | Uses | Files |
|-------|------|------|-------|
| `30_000` | ms (30 sec) | Screenshot capture interval | SessionManager (176, 410), ScreenshotService (186) |
| `5 * 60 * 1000` | ms (5 min) | Auto-analysis interval | SessionManager (292) |
| `25 * 60 * 1000` | ms (25 min) | Default session duration | SessionSetupView (10) |

### UI/Window Constants

| Value | Type | Use | Files |
|-------|------|-----|-------|
| `160` | pixels | Widget circle size | WindowManager (10) |
| `440` | pixels | Panel width | WindowManager (11) |
| `380` | pixels | Panel height | WindowManager (12) |
| `20` | pixels | Screen margin | WindowManager (47, 319) |
| `5` | count | Max queued view changes | WindowManager (24) |

### Screenshot Processing Constants

| Value | Type | Use | Files |
|-------|------|-----|-------|
| `0.85` | ratio | JPEG quality | preload.js (17) |
| `1440` | pixels | Max screenshot width | preload.js (16) |
| `8` | chars | SHA hash length | ScreenshotService (26) |
| `10` | count | Default recent screenshots to fetch | SessionManager (296), ScreenshotService (116) |

### Input Constraints

| Value | Type | Use | Files |
|-------|------|-----|-------|
| `280` | chars | Focus goal max length | SessionSetupView (110, 111, 125, 128) |

### Session Cleanup Buffer

| Value | Type | Use | Files |
|-------|------|-----|-------|
| `5000` | ms (5 sec) | Buffer after session for file deletion | ScreenshotService (162) |

---

## 4. Current Constants/Config Files

### A. Existing Configuration
- **ConfigService.ts** - App settings (window position, demo mode, tasks enabled)
- **Environment Variables** (.env) - API keys
- **No dedicated constants file exists** - magic numbers are scattered throughout

### B. Default Values in ConfigService
```typescript
getDemoMode(): boolean {
    return this.config.demoMode ?? true;  // Default: demo mode ON
}

getTasksEnabled(): boolean {
    return this.config.tasksEnabled ?? true;  // Default: tasks enabled
}

getWindowPosition(): 'top-left' | 'top-center' | 'top-right' {
    return this.config.windowPosition || 'top-right';
}
```

---

## 5. Main Components & Their Responsibilities

### Frontend - React Components

#### A. WidgetApp.tsx (src/components/WidgetApp.tsx)
**Type:** Main widget UI  
**Complexity:** MEDIUM

**Responsibilities:**
- Capture screenshots on IPC command
- Display permissions modal if needed
- Show session state (active/inactive)
- Route to different panel views via buttons

**Key Methods:**
- `grab()` - Screenshot capture handler
- `openSessionPanel()` - Request session setup view
- `handleEndSession()` - Stop session
- `handleOpenSettings()` - Request settings view
- `handleOpenPanel()` - Request analysis view

**No magic numbers** but important state management:
- `capturingRef` prevents overlapping captures (race condition protection)
- Listens to `onSessionUpdated` and `onScreenshotCapture` IPC events

---

#### B. PanelApp.tsx (src/components/PanelApp.tsx)
**Type:** Panel router/navigation  
**Complexity:** MEDIUM

**Responsibilities:**
- Route between different panel views
- Manage current view state
- Handle view lifecycle callbacks
- Pass analysis data to child views

**Architecture Issue:**
- Tightly couples view state with view components
- Views pass callbacks like `onComplete={() => setCurrentView('analysis')}`
- Creates bidirectional dependencies

---

#### C. Panel View Components (src/components/panel-views/)

| Component | Purpose | Key State | Lines |
|-----------|---------|-----------|-------|
| **SessionSetupView.tsx** | Start new session | duration, focusGoal, tasks | ~140 |
| **AnalysisView.tsx** | Show AI analysis results | analysis text | ~80 |
| **DistractedReasonView.tsx** | Reason for distraction | reason, isSubmitting | ~120 |
| **InterruptionReflectionView.tsx** | Reflect on system wake | reflection | ~100 |
| **DeeperReflectionView.tsx** | Deeper session reflection | reflection, isSubmitting | ~120 |
| **SettingsView.tsx** | App settings | window position, demo mode | ~150 |
| **TasksView.tsx** | Display tasks during session | tasks list | ~80 |

**Common Pattern (DRY Violation):**
All reflection views follow same pattern:
```typescript
async function handleSaveAndEnd() {
    setIsSubmitting(true);
    const res = await window.api.saveXyz(data);
    if (res.ok) {
        setState('');
        await window.api.hidePanel();
        onComplete();
    }
    setIsSubmitting(false);
}
```

This pattern appears **7+ times** across views.

---

#### D. Contexts (src/contexts/)

| Context | Purpose | Provider |
|---------|---------|----------|
| **SessionContext** | Current session state | Broadcast from SessionManager |
| **SettingsContext** | App settings | ConfigService via IPC |
| **ThemeContext** | Light/dark mode | Local state |

---

### Backend - Electron Services

#### Service Dependency Graph
```
main.ts (entry point)
  ├─ ConfigService
  ├─ WindowManager (depends on ConfigService)
  ├─ ScreenshotService
  ├─ AIAnalysisService
  ├─ StorageService
  └─ SessionManager
       ├─ WindowManager
       ├─ StorageService
       ├─ ScreenshotService
       ├─ AIAnalysisService
       └─ ConfigService
```

All services are initialized in `main.ts` (lines 16-28) before IPC handlers are registered.

---

## 6. IPC Architecture

### IPC Bridge (preload.js)
Acts as context-isolated bridge between renderer and main process.

**Categories of IPC Methods:**

1. **Screenshot APIs:**
   - `captureFrames(options)` - Capture single frame
   - `saveImage(payload)` - Save captured frame to disk
   - `getRecentImages(limit)` - Get stored images

2. **Session APIs:**
   - `sessionStart(lengthMs, focusGoal, tasks)`
   - `sessionStop()`
   - `sessionGetState()`
   - `sessionListByDate(dateString)`
   - `sessionGet(sessionId, dateString)`
   - `sessionListAll()`

3. **Interruption/Reflection APIs:**
   - `handleInterruption(action, reflection)` - Handle pause/resume
   - `handleReflection(action, reflection)` - Save reflection
   - `saveDistractionReason(reason)`
   - `pauseSession()` - Pause on system sleep

4. **Window/UI APIs:**
   - `showPanel()`, `hidePanel()`
   - `setWindowPosition(position)`
   - `requestSessionSetup()` - Show session setup view
   - `requestSettings()` - Show settings view
   - `requestAnalysis()` - Show analysis view

5. **Settings APIs:**
   - `getSettings()` - Get all settings
   - `updateSettings(partial)` - Update settings

6. **Event Listeners:**
   - `onSessionUpdated(callback)` - Session state changes
   - `onScreenshotCapture(callback)` - Screenshot trigger request
   - `onViewChangeRequested(callback)` - Panel view changes

---

## 7. Session Lifecycle & State Management

### Session State Flow

```
┌─────────────────────────────────────────────────────┐
│ Idle (no active session)                            │
│ sessionState.isActive = false                       │
└──────────┬──────────────────────────────────────────┘
           │ User clicks "New Session"
           ▼
┌─────────────────────────────────────────────────────┐
│ SessionSetupView                                    │
│ - Set duration (1-∞ minutes)                        │
│ - Set focus goal (text, max 280 chars)             │
│ - Set tasks (3 tasks, each max 280 chars)          │
│ Click "Start"                                       │
└──────────┬──────────────────────────────────────────┘
           │ IPC: sessionStart()
           │
           ├─► SessionManager.startSession()
           │   ├─ Create session file (StorageService)
           │   ├─ Start screenshot timer (30s init, then 30s interval)
           │   ├─ Start analysis timer (5min, if demo mode OFF)
           │   ├─ Start session timer (fires at lengthMs)
           │   └─ Broadcast sessionState.isActive = true
           │
           ▼
┌─────────────────────────────────────────────────────┐
│ Active Session (Running)                            │
│ sessionState.isActive = true                        │
│ - Screenshots captured every 30 seconds             │
│ - Analysis runs every 5 minutes (auto-analysis)     │
│ - Session timer counting down                       │
└──────────┬──────────────────────────────────────────┘
           │
           ├─ [Every 30s] Screenshot captured
           │  └─► Saved to disk via ScreenshotService
           │
           ├─ [Every 5 min] (if demo mode OFF)
           │  └─► Auto-analysis via AIAnalysisService
           │      ├─► If distracted: Show DistractedReasonView
           │      └─► If focused: Keep hidden
           │
           ├─ [System Sleep Event]
           │  └─► SessionManager.pauseSession()
           │      ├─ Stop all timers
           │      ├─ Calculate remaining time
           │      ├─ Show InterruptionReflectionView
           │      └─ Wait for user action
           │
           ├─ [User clicks widget button]
           │  └─► Manual analysis or other actions
           │
           └─ [Session timer expires]
              └─► SessionManager.stopSession()
                  ├─ Stop all timers (CRITICAL ORDER!)
                  ├─ Generate final summary
                  ├─ Set isActive = false
                  └─ Show analysis panel
           ▼
┌─────────────────────────────────────────────────────┐
│ Session Complete                                    │
│ AnalysisView shows final summary                    │
│ User can review or end                              │
└─────────────────────────────────────────────────────┘
```

### Timer Orchestration (COMPLEX & FRAGILE)

**Problem:** Three separate timers with implicit dependencies:

```typescript
// Timer 1: Session duration countdown
this.sessionTimer = setTimeout(async () => {
    await this.stopSession();  // This calls stopters for both other timers!
}, lengthMs);

// Timer 2: Screenshot capture
this.screenshotTimer = setTimeout(() => {
    if (!sessionState.isActive) return;
    windowManager.triggerScreenshotCapture();
    
    this.screenshotTimer = setInterval(() => {
        if (!sessionState.isActive) {
            this.stopScreenshotTimer();
        }
        windowManager.triggerScreenshotCapture();
    }, 30_000);  // MAGIC NUMBER 1
}, 30_000);  // MAGIC NUMBER 2

// Timer 3: Auto-analysis
const intervalMs = 5 * 60 * 1000;  // MAGIC NUMBER 3
this.analysisTimer = setInterval(async () => {
    await this.handleDistractionAnalysis(10);  // MAGIC NUMBER 4
}, intervalMs);
```

**Critical Issue:** Lines 237-242 in SessionManager show comment but no enforcement:
```typescript
async stopSession(): Promise<void> {
    // CRITICAL: Stop all timers FIRST...
    this.stopSessionTimer();
    this.stopScreenshotTimer();
    this.stopAnalysisTimer();
    
    // Generate final summary AFTER stopping timers
    await this.generateFinalSummary();  // <-- Must happen after timers stop
}
```

If someone reorders these, final summaries silently fail.

---

## 8. Where Magic Numbers Are Currently Used

### Summary Table

| Number | Location(s) | Purpose |
|--------|------------|---------|
| **30_000** | SessionManager:176, SessionManager:410, ScreenshotService:186 | Screenshot interval (30 sec) |
| **5 * 60 * 1000** | SessionManager:292 | Auto-analysis interval (5 min) |
| **25 * 60 * 1000** | SessionSetupView:10 | Default session duration |
| **160** | WindowManager:10 | Widget circle size |
| **440** | WindowManager:11 | Panel width |
| **380** | WindowManager:12 | Panel height |
| **20** | WindowManager:47, WindowManager:319 | Screen margin |
| **5** | WindowManager:24 | Max pending view changes |
| **0.85** | preload.js:17 | JPEG quality ratio |
| **1440** | preload.js:16 | Max screenshot width (pixels) |
| **280** | SessionSetupView:110, 111, 125, 128 | Max input length (chars) |
| **8** | ScreenshotService:26 | SHA hash length |
| **10** | SessionManager:296, ScreenshotService:116 | Default recent screenshots |
| **5000** | ScreenshotService:162 | Cleanup buffer (5 sec) |

---

## 9. Architecture Overview Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    ELECTRON MAIN PROCESS                      │
│                    (electron/main.ts)                         │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Services Layer (all initialized in main.ts):               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ • ConfigService - persistence                        │   │
│  │ • WindowManager - window lifecycle & positioning     │   │
│  │ • SessionManager - session & timer orchestration ⚠️  │   │
│  │ • ScreenshotService - disk I/O                       │   │
│  │ • AIAnalysisService - LLM calls                      │   │
│  │ • StorageService - session data storage              │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                    │
│                          ▼                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         IPC Handlers (IPCHandlers.ts)               │   │
│  │  Routes events from renderer to services             │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└────────────┬─────────────────────────────────────────────────┘
             │ IPC Events (preload.js bridge)
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│              ELECTRON RENDERER PROCESS                        │
│         (React App: src/components/*.tsx)                     │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  WidgetApp (src/components/WidgetApp.tsx)                   │
│  ├─ Circular widget with 4 wedge buttons                    │
│  ├─ Screenshot capture trigger                              │
│  └─ Displays session state                                  │
│                                                               │
│  PanelApp (src/components/PanelApp.tsx)                     │
│  └─ Router between panel views:                             │
│     ├─ SessionSetupView - start session                     │
│     ├─ AnalysisView - show results                          │
│     ├─ DistractedReasonView - capture distraction reason    │
│     ├─ InterruptionReflectionView - system wake handling    │
│     ├─ DeeperReflectionView - deeper reflection             │
│     ├─ SettingsView - app configuration                     │
│     └─ TasksView - show tasks during session                │
│                                                               │
│  Contexts:                                                    │
│  ├─ SessionContext - broadcasts from SessionManager         │
│  ├─ SettingsContext - from ConfigService                    │
│  └─ ThemeContext - local                                    │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## 10. Key Insights for Refactoring

### High Priority Issues

1. **SessionManager is too complex** (557 lines, 7+ responsibilities)
   - Needs extraction of timer orchestration
   - Needs explicit state machine for session lifecycle
   - Timer cleanup has undocumented ordering dependency

2. **Magic numbers scattered everywhere** (14 different values)
   - No centralized configuration
   - Screenshot interval used in 3 places
   - Hard to tune timing without search-replace

3. **Temporal coupling in timer cleanup**
   - `stopSession()` has implicit ordering (lines 237-242)
   - No enforcement of order
   - Can silently fail if reordered

4. **DRY violation in panel views**
   - "Save & hide panel" pattern appears 7+ times
   - Each view duplicates same boilerplate
   - Candidate for custom hook: `useSaveWithAction()`

### Medium Priority Issues

5. **WindowManager holds stale references** (line 269-270)
   - No `isDestroyed()` checks before IPC send
   - Silent failures if window closed externally

6. **View change queueing logic mixed with window management**
   - Lines 214-230 should be extracted to separate service
   - WindowManager doing too much

7. **Demo mode is hidden global state**
   - Affects analysis timer but behavior not obvious
   - Only re-evaluated when settings change
   - Should have feature flag service with broadcasts

---

## 11. Recommended Next Steps

1. **Explore magic number usage in depth** - Search grep results for all 14 values
2. **Create constants file** - `src/constants.ts` and `electron/constants.ts`
3. **Document the timer orchestration** - Explicit state machine or builder
4. **Extract DRY patterns** - `useSaveWithAction` hook for panel views
5. **Split SessionManager** - Separate timer logic into `SessionTimerOrchestrator`

