import { app, BrowserWindow } from 'electron';
import 'dotenv/config';

// Import services
import { ConfigService } from './services/ConfigService.js';
import { WindowManager } from './services/WindowManager.js';
import { SessionManager } from './services/SessionManager.js';
import { ScreenshotService } from './services/ScreenshotService.js';
import { AIAnalysisService } from './services/AIAnalysisService.js';
import { StorageService } from './services/StorageService.js';

// Import IPC handlers
import { registerIPCHandlers } from './handlers/IPCHandlers.js';

// Initialize services
const configService = new ConfigService();
const windowManager = new WindowManager(configService);
const screenshotService = new ScreenshotService();
const aiService = new AIAnalysisService();
const storageService = new StorageService();
const sessionManager = new SessionManager(windowManager, storageService, screenshotService, aiService, configService);

/**
 * Initialize the application
 */
async function initialize() {
    console.log('[Main] Initializing application');

    // Initialize AI service (load prompts)
    try {
        await aiService.initialize();
        console.log('[Main] AI service initialized');
    } catch (error) {
        console.error('[Main] Failed to initialize AI service:', error);
        throw error;
    }

    // Create windows
    await windowManager.createWidgetWindow();
    console.log('[Main] Widget window created');

    // Setup power monitoring for session interruptions
    sessionManager.setupPowerMonitoring();
    console.log('[Main] Power monitoring setup complete');

    // Register all IPC handlers
    registerIPCHandlers(
        windowManager,
        sessionManager,
        screenshotService,
        aiService,
        storageService,
        configService
    );
    console.log('[Main] IPC handlers registered');
}

// App lifecycle events
app.whenReady().then(() => {
    initialize().catch((error) => {
        console.error('[Main] Initialization failed:', error);
        app.quit();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        initialize();
    }
});
