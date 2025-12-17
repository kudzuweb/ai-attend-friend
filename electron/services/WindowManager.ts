import { app, BrowserWindow, screen } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SessionState } from '../types/session.types.js';
import type { ConfigService } from './ConfigService.js';
import {
    WINDOW_MARGIN,
    MAIN_WINDOW_MIN_WIDTH,
    MAIN_WINDOW_MIN_HEIGHT,
    MAIN_WINDOW_DEFAULT_WIDTH,
    MAIN_WINDOW_DEFAULT_HEIGHT,
    SESSION_WIDGET_WIDTH,
    SESSION_WIDGET_HEIGHT
} from '../constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class WindowManager {
    private mainWindow: BrowserWindow | null = null;
    private sessionWidget: BrowserWindow | null = null;
    private sessionWidgetLoading: Promise<BrowserWindow> | null = null;
    private preloadPath: string;
    private configService: ConfigService;

    constructor(configService: ConfigService) {
        this.configService = configService;
        this.preloadPath = path.resolve(__dirname, '../../electron/preload.js');
    }

    /**
     * Create the main application window
     */
    async createMainWindow(): Promise<BrowserWindow> {
        console.log('[WindowManager] Creating main window');

        this.mainWindow = new BrowserWindow({
            width: MAIN_WINDOW_DEFAULT_WIDTH,
            height: MAIN_WINDOW_DEFAULT_HEIGHT,
            minWidth: MAIN_WINDOW_MIN_WIDTH,
            minHeight: MAIN_WINDOW_MIN_HEIGHT,
            show: true,
            titleBarStyle: 'hiddenInset',
            trafficLightPosition: { x: 16, y: 16 },
            webPreferences: {
                preload: this.preloadPath,
                contextIsolation: true,
                nodeIntegration: false
            }
        });

        if (process.platform === 'darwin') {
            app.dock?.show();
        }

        if (process.env.NODE_ENV !== 'production') {
            await this.mainWindow.loadURL('http://localhost:5173');
            this.mainWindow.webContents.openDevTools({ mode: 'detach' });
        } else {
            await this.mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
        }

        return this.mainWindow;
    }

    getMainWindow(): BrowserWindow | null {
        return this.mainWindow;
    }

    /**
     * Create the session widget window
     */
    async createSessionWidget(): Promise<BrowserWindow> {
        console.log('[WindowManager] Creating session widget');

        const display = screen.getPrimaryDisplay();
        const { width: screenWidth } = display.workAreaSize;
        const { x: screenX, y: screenY } = display.workArea;

        const x = screenX + screenWidth - SESSION_WIDGET_WIDTH - WINDOW_MARGIN;
        const y = screenY + WINDOW_MARGIN;

        this.sessionWidget = new BrowserWindow({
            x,
            y,
            width: SESSION_WIDGET_WIDTH,
            height: SESSION_WIDGET_HEIGHT,
            show: false,
            frame: false,
            transparent: false,
            backgroundColor: '#F6F4EE',
            resizable: false,
            movable: true,
            hasShadow: true,
            fullscreenable: false,
            skipTaskbar: true,
            webPreferences: {
                preload: this.preloadPath,
                contextIsolation: true,
                nodeIntegration: false
            }
        });

        this.sessionWidget.setAlwaysOnTop(true, 'floating', 1);
        this.sessionWidget.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

        if (process.env.NODE_ENV !== 'production') {
            await this.sessionWidget.loadURL('http://localhost:5173/#/session-widget');
        } else {
            await this.sessionWidget.loadURL(`file://${path.join(__dirname, '../../dist/index.html')}#/session-widget`);
        }

        return this.sessionWidget;
    }

    /**
     * Show the session widget
     */
    async showSessionWidget(): Promise<void> {
        if (this.sessionWidgetLoading) {
            await this.sessionWidgetLoading;
        } else if (!this.sessionWidget) {
            this.sessionWidgetLoading = this.createSessionWidget();
            await this.sessionWidgetLoading;
            this.sessionWidgetLoading = null;
        }
        this.sessionWidget?.show();
    }

    /**
     * Hide the session widget
     */
    hideSessionWidget(): void {
        this.sessionWidget?.hide();
    }

    /**
     * Get session widget window
     */
    getSessionWidget(): BrowserWindow | null {
        return this.sessionWidget;
    }

    /**
     * Broadcast session state to all windows
     */
    broadcastSessionState(sessionState: SessionState): void {
        this.sessionWidget?.webContents.send('session:updated', sessionState);
        this.mainWindow?.webContents.send('session:updated', sessionState);
    }

    /**
     * Trigger screenshot capture in main window
     */
    triggerScreenshotCapture(): void {
        this.mainWindow?.webContents.send('screenshot:capture');
    }

    /**
     * Broadcast interruption event to session widget
     */
    broadcastInterruption(data: { durationMs: number }): void {
        this.sessionWidget?.webContents.send('session:interruption', data);
    }

    /**
     * Broadcast distraction event to session widget
     */
    broadcastDistraction(): void {
        this.sessionWidget?.webContents.send('session:distraction');
    }

    /**
     * Close all windows
     */
    closeAll(): void {
        this.mainWindow?.close();
        this.sessionWidget?.close();
        this.mainWindow = null;
        this.sessionWidget = null;
    }
}
