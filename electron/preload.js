const { contextBridge, ipcRenderer } = require('electron');

// Screenshot constants (defined here due to preload.js CommonJS limitations)
// Master values are in electron/constants.js
const SCREENSHOT_MAX_WIDTH = 1440;
const SCREENSHOT_JPEG_QUALITY = 0.85;

// function to check permissions status
async function getScreenPermissionStatus() {
    return ipcRenderer.invoke('screen-permission-status');
}

// function to get media sources
async function listScreens() {
    return ipcRenderer.invoke('desktopCapturer-get-sources', { types: ['screen'] })
}

// screenshot function
async function captureFrames(options) {
    // constraining resolution and quality to minimize cost while ensuring legibility for LLM
    const maxLongEdge = options?.maxLongEdge ?? SCREENSHOT_MAX_WIDTH;
    const jpegQuality = options?.jpegQuality ?? SCREENSHOT_JPEG_QUALITY;

    // select display as source
    const sources = await listScreens();
    const source = sources[0];
    // TODO: add a picker for multiple displays


    const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
            // @ts-expect-error: chromium-specific WebRTC constraints
            mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: source.id,
                maxWidth: 8000,
                maxHeight: 8000,
                maxFrameRate: 1,
            },
            // ensure cursor shows
            cursor: 'always',
        }
    });

    // create a hidden <video> to pipe video to
    const video = document.createElement('video');
    video.srcObject = stream;

    // wait for video frame to actually exist before trying to use it
    await new Promise(res => {
        video.onloadedmetadata = () => {
            video.play().then(() => res());
        };
    });
    // compute target size, preserving aspect ratio
    const srcW = video.videoWidth;
    const srcH = video.videoHeight;
    const scale = Math.min(1, maxLongEdge / Math.max(srcW, srcH));
    const dstW = Math.max(1, Math.round(srcW * scale));
    const dstH = Math.max(1, Math.round(srcH * scale));


    //create canvas, match size to video frame size, copy the frame onto it
    const canvas = document.createElement('canvas');
    canvas.width = dstW;
    canvas.height = dstH;
    const ctx = canvas.getContext('2d', { alpha: false });
    // high quality resampling to preserve text fidelity
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // cleanup: turn off the capture feed after grabbing frame and reset source
    video.pause();

    // @ts-expect-error: srcObject assignment
    video.srcObject = null;
    video.remove();
    stream.getTracks().forEach(t => t.stop());

    const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
            'image/jpeg',
            jpegQuality,
        )
    });
    // convert blob to base64
    const arrayBuf = await blob.arrayBuffer();
    const base64 = Buffer.from(arrayBuf).toString('base64');
    // export dataURL
    return {
        dataUrl: `data:image/jpeg;base64,${base64}`,
        capturedAt: new Date().toISOString(),
    };
}

console.log("running preload!!!")
// expose safe APIs to the webpage(constrains node access)
const api = Object.freeze({
    getScreenPermissionStatus,
    openScreenRecordingSettings: () =>
        ipcRenderer.invoke('open-screen-recording-settings'),
    relaunchApp: () =>
        ipcRenderer.invoke('relaunch-app'),
    quitApp: () =>
        ipcRenderer.invoke('quit-app'),
    captureFrames: captureFrames,
    saveImage: (payload) =>
        ipcRenderer.invoke('save-image', payload),
    getRecentImages: (limit) =>
        ipcRenderer.invoke('images:get-recent', limit),
    analyzeRecent: (limit) =>
        ipcRenderer.invoke('llm:send-recent', limit),
    // settings APIs
    getSettings: () => ipcRenderer.invoke('settings:get'),
    updateSettings: (partial) => ipcRenderer.invoke('settings:update', partial),
    // session APIs
    sessionStart: (lengthMs, focusGoal, tasks) =>
        ipcRenderer.invoke('session:start', lengthMs, focusGoal, tasks),
    sessionGetState: () =>
        ipcRenderer.invoke('session:get-state'),
    sessionStop: () =>
        ipcRenderer.invoke('session:stop'),
    sessionListByDate: (dateString) =>
        ipcRenderer.invoke('session:list-by-date', dateString),
    sessionListAll: () =>
        ipcRenderer.invoke('session:list-all'),
    sessionGet: (sessionId, dateString) =>
        ipcRenderer.invoke('session:get', sessionId, dateString),
    onSessionUpdated: (callback) => {
        const handler = (_event, state) => callback(state);
        ipcRenderer.on('session:updated', handler);
        return () => ipcRenderer.removeListener('session:updated', handler);
    },
    onInterruption: (callback) => {
        const handler = (_event, data) => callback(data);
        ipcRenderer.on('session:interruption', handler);
        return () => ipcRenderer.removeListener('session:interruption', handler);
    },
    handleInterruption: (action, reflection) =>
        ipcRenderer.invoke('session:handle-interruption', { action, reflection }),
    handleReflection: (action, reflection) =>
        ipcRenderer.invoke('session:handle-reflection', { action, reflection }),
    saveDistractionReason: (reason) =>
        ipcRenderer.invoke('session:save-distraction-reason', reason),
    pauseSession: () =>
        ipcRenderer.invoke('session:pause'),
    saveStuckReflection: (reflection) =>
        ipcRenderer.invoke('session:save-stuck-reflection', reflection),
    // Task APIs
    getTasks: () =>
        ipcRenderer.invoke('task:getAll'),
    getTaskById: (taskId) =>
        ipcRenderer.invoke('task:getById', taskId),
    getActiveTasksForSetup: () =>
        ipcRenderer.invoke('task:getActiveForSetup'),
    createTask: (payload) =>
        ipcRenderer.invoke('task:create', payload),
    toggleTaskComplete: (taskId) =>
        ipcRenderer.invoke('task:toggleComplete', taskId),
    updateTask: (taskId, payload) =>
        ipcRenderer.invoke('task:update', taskId, payload),
    deleteTask: (taskId) =>
        ipcRenderer.invoke('task:delete', taskId),
    restoreTask: (taskId) =>
        ipcRenderer.invoke('task:restore', taskId),
    // Open Loop APIs
    getOpenLoops: (includeArchived) =>
        ipcRenderer.invoke('openloop:getAll', includeArchived),
    getActiveOpenLoops: () =>
        ipcRenderer.invoke('openloop:getActive'),
    getOpenLoopById: (loopId) =>
        ipcRenderer.invoke('openloop:getById', loopId),
    createOpenLoop: (payload) =>
        ipcRenderer.invoke('openloop:create', payload),
    toggleOpenLoopComplete: (loopId) =>
        ipcRenderer.invoke('openloop:toggleComplete', loopId),
    archiveOpenLoop: (loopId) =>
        ipcRenderer.invoke('openloop:archive', loopId),
    // Journal APIs
    getJournalEntries: (filterSessionId) =>
        ipcRenderer.invoke('journal:getAll', filterSessionId),
    createJournalEntry: (payload) =>
        ipcRenderer.invoke('journal:create', payload),
    updateJournalEntry: (entryId, payload) =>
        ipcRenderer.invoke('journal:update', entryId, payload),
    deleteJournalEntry: (entryId) =>
        ipcRenderer.invoke('journal:delete', entryId),
    // Window control APIs
    showSessionWidget: () =>
        ipcRenderer.invoke('window:show-session-widget'),
    hideSessionWidget: () =>
        ipcRenderer.invoke('window:hide-session-widget'),
    minimizeMainWindow: () =>
        ipcRenderer.invoke('window:minimize-main'),
    restoreMainWindow: () =>
        ipcRenderer.invoke('window:restore-main'),
    // Screenshot capture listener
    onScreenshotCapture: (callback) => {
        const handler = () => callback();
        ipcRenderer.on('screenshot:capture', handler);
        return () => ipcRenderer.removeListener('screenshot:capture', handler);
    },
})

contextBridge.exposeInMainWorld('api', api)
