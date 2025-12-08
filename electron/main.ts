import { app, BrowserWindow } from 'electron';
import 'dotenv/config';

// Import services
import { ConfigService } from './services/ConfigService.js';
import { WindowManager } from './services/WindowManager.js';
import { SessionManager } from './services/SessionManager.js';
import { ScreenshotService } from './services/ScreenshotService.js';
import { AIAnalysisService } from './services/AIAnalysisService.js';
import { StorageService } from './services/StorageService.js';
import { TaskStorage } from './services/TaskStorage.js';
import { OpenLoopStorage } from './services/OpenLoopStorage.js';
import { JournalStorage } from './services/JournalStorage.js';
import { DataMigrationService } from './services/DataMigrationService.js';

// Import IPC handlers
import { registerIPCHandlers } from './handlers/IPCHandlers.js';

// Initialize services
console.log('[Main] Initializing services...');
const configService = new ConfigService();
console.log('[Main] ConfigService initialized');
const windowManager = new WindowManager(configService);
console.log('[Main] WindowManager initialized');
const screenshotService = new ScreenshotService();
console.log('[Main] ScreenshotService initialized');
const aiService = new AIAnalysisService();
console.log('[Main] AIAnalysisService initialized');
const storageService = new StorageService();
console.log('[Main] StorageService initialized');

// NEW: Initialize new storage services
const taskStorage = new TaskStorage();
console.log('[Main] TaskStorage initialized');
const openLoopStorage = new OpenLoopStorage();
console.log('[Main] OpenLoopStorage initialized');
const journalStorage = new JournalStorage();
console.log('[Main] JournalStorage initialized');

const sessionManager = new SessionManager(windowManager, storageService, screenshotService, aiService, configService);
console.log('[Main] SessionManager initialized');

/**
 * Initialize the application
 */
async function initialize() {
    console.log('[Main] Initializing application');

    // NEW: Initialize new storage services
    await taskStorage.init();
    console.log('[Main] TaskStorage storage initialized');
    await openLoopStorage.init();
    console.log('[Main] OpenLoopStorage storage initialized');
    await journalStorage.init();
    console.log('[Main] JournalStorage storage initialized');

    // NEW: Run data migration
    const migrationService = new DataMigrationService(
        storageService,
        taskStorage,
        journalStorage,
        configService
    );
    await migrationService.runMigrations();
    console.log('[Main] Data migration complete');

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
    console.log('[Main] ✓ Application initialization complete');
}

// App lifecycle events
app.whenReady().then(() => {
    console.log('[Main] Electron app ready, starting initialization...');
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
