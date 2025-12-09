import { app, BrowserWindow, screen } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SessionState } from '../types/session.types.js';
import type { ConfigService } from './ConfigService.js';
import {
    WIDGET_CIRCLE_SIZE,
    PANEL_WIDTH,
    PANEL_HEIGHT,
    WINDOW_MARGIN,
    MAX_PENDING_CHANGES,
    MAIN_WINDOW_MIN_WIDTH,
    MAIN_WINDOW_MIN_HEIGHT,
    MAIN_WINDOW_DEFAULT_WIDTH,
    MAIN_WINDOW_DEFAULT_HEIGHT,
    SESSION_WIDGET_WIDTH,
    SESSION_WIDGET_HEIGHT
} from '../constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type ViewChangePayload = {
    view: 'session-setup' | 'settings' | 'tasks' | 'interruption-reflection' | 'distracted-reason' | 'analysis';
    data?: any;
};

export class WindowManager {
    private widgetWindow: BrowserWindow | null = null;
    private panelWindow: BrowserWindow | null = null;
    private mainWindow: BrowserWindow | null = null;
    private sessionWidget: BrowserWindow | null = null;
    private preloadPath: string;
    private pendingViewChanges: ViewChangePayload[] = [];
    private currentPosition: 'top-left' | 'top-center' | 'top-right' = 'top-right';
    private configService: ConfigService;

    constructor(configService: ConfigService) {
        this.configService = configService;
        // absolute path to built preload
        this.preloadPath = path.resolve(__dirname, '../../electron/preload.js');
    }

    /**
     * Create the circular widget window
     */
    async createWidgetWindow(): Promise<BrowserWindow> {
        console.log("createWidgetWindow() called at", new Date());

        // Calculate initial position based on saved preference
        const savedPosition = this.configService.getWindowPosition();
        this.currentPosition = savedPosition;

        const display = screen.getPrimaryDisplay();
        const { width: screenWidth } = display.workAreaSize;
        const { x: screenX, y: screenY } = display.workArea;

        let x: number;
        const y = screenY + WINDOW_MARGIN;

        switch (savedPosition) {
            case 'top-left':
                x = screenX + WINDOW_MARGIN;
                break;
            case 'top-center':
                x = screenX + Math.round((screenWidth - WIDGET_CIRCLE_SIZE) / 2);
                break;
            case 'top-right':
                x = screenX + screenWidth - WIDGET_CIRCLE_SIZE - WINDOW_MARGIN;
                break;
        }

        this.widgetWindow = new BrowserWindow({
            x,
            y,
            width: WIDGET_CIRCLE_SIZE,
            height: WIDGET_CIRCLE_SIZE,
            show: false,
            frame: false,
            transparent: true,
            movable: true,
            hasShadow: false,
            fullscreenable: false,
            skipTaskbar: true,
            webPreferences: {
                preload: this.preloadPath,
                contextIsolation: true,
                nodeIntegration: false
            }
        });

        // widget config
        this.widgetWindow.setAlwaysOnTop(true, 'floating', 1);
        this.widgetWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

        // hide from task switchers, etc, so it acts like a utility HUD instead of a window
        if (process.platform === 'darwin') app.dock?.hide();

        // hard-clamp size so mac can't "help" by overriding my resizable: false
        this.widgetWindow.setMinimumSize(WIDGET_CIRCLE_SIZE, WIDGET_CIRCLE_SIZE);
        this.widgetWindow.setMaximumSize(WIDGET_CIRCLE_SIZE, WIDGET_CIRCLE_SIZE);
        this.widgetWindow.setAspectRatio(1);

        // load renderer
        if (process.env.NODE_ENV !== 'production') {
            await this.widgetWindow.loadURL('http://localhost:5173');
            this.widgetWindow.webContents.openDevTools({ mode: 'detach' });
        } else {
            await this.widgetWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
        }

        this.widgetWindow.show();

        // keep panel centered below circle
        this.widgetWindow.on('move', () => {
            if (!this.widgetWindow || !this.panelWindow || !this.panelWindow.isVisible()) return;
            this.positionPanelBelowWidget();
        });

        return this.widgetWindow;
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
            frame: true,
            webPreferences: {
                preload: this.preloadPath,
                contextIsolation: true,
                nodeIntegration: false
            }
        });

        // Show in dock/taskbar
        if (process.platform === 'darwin') {
            app.dock?.show();
        }

        // Load main app
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
     * Create the session widget window (rectangular, for new architecture)
     */
    async createSessionWidget(): Promise<BrowserWindow> {
        console.log('[WindowManager] Creating session widget');

        // Calculate position (top-right corner by default)
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

        // Widget config
        this.sessionWidget.setAlwaysOnTop(true, 'floating', 1);
        this.sessionWidget.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

        // Load renderer with session widget route
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
    showSessionWidget(): void {
        if (!this.sessionWidget) {
            this.createSessionWidget().then(() => {
                this.sessionWidget?.show();
            });
        } else {
            this.sessionWidget.show();
        }
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
     * Create and show the panel window
     */
    showPanel(): void {
        if (!this.widgetWindow) return;

        if (!this.panelWindow) {
            this.panelWindow = new BrowserWindow({
                parent: this.widgetWindow,
                width: PANEL_WIDTH,
                height: PANEL_HEIGHT,
                frame: false,
                transparent: false,
                backgroundColor: '#F6F4EE',
                show: false,
                alwaysOnTop: true,
                skipTaskbar: true,
                webPreferences: {
                    preload: this.preloadPath,
                },
            });

            // Listen for when the panel finishes loading
            this.panelWindow.webContents.on('did-finish-load', () => {
                if (this.pendingViewChanges.length > 0) {
                    console.log('Panel loaded, sending', this.pendingViewChanges.length, 'queued view changes');
                    // Send all queued changes in order
                    for (const change of this.pendingViewChanges) {
                        this.panelWindow?.webContents.send('panel:change-view', change);
                    }
                    this.pendingViewChanges = [];
                }
            });

            // load renderer
            if (process.env.NODE_ENV !== 'production') {
                this.panelWindow.loadURL('http://localhost:5173/#/panel');
                this.panelWindow.webContents.openDevTools({ mode: 'detach' });
            } else {
                this.panelWindow.loadURL(`file://${path.join(__dirname, '../../dist/index.html')}#/panel`);
            }
        } else if (this.pendingViewChanges.length > 0) {
            // Panel already exists and is loaded, send all queued changes immediately
            console.log('Panel already loaded, sending', this.pendingViewChanges.length, 'queued changes immediately');
            for (const change of this.pendingViewChanges) {
                this.panelWindow.webContents.send('panel:change-view', change);
            }
            this.pendingViewChanges = [];
        }

        this.positionPanelBelowWidget();
        this.panelWindow.show();
    }

    /**
     * Hide the panel window
     */
    hidePanel(): void {
        if (this.panelWindow) {
            this.panelWindow.hide();
            // Clear pending view changes queue if panel is hidden
            this.pendingViewChanges = [];
        }
    }

    /**
     * Position panel below widget with smart alignment
     */
    private positionPanelBelowWidget(): void {
        if (!this.widgetWindow || !this.panelWindow) return;

        const parentBounds = this.widgetWindow.getBounds();
        let panelX: number;

        switch (this.currentPosition) {
            case 'top-left':
                // Align panel's left edge with widget's left edge
                panelX = parentBounds.x;
                break;
            case 'top-center':
                // Center panel under widget
                panelX = parentBounds.x + (parentBounds.width - PANEL_WIDTH) / 2;
                break;
            case 'top-right':
                // Align panel's right edge with widget's right edge
                panelX = parentBounds.x + parentBounds.width - PANEL_WIDTH;
                break;
        }

        this.panelWindow.setBounds({
            x: Math.round(panelX),
            y: parentBounds.y + parentBounds.height,
            width: PANEL_WIDTH,
            height: PANEL_HEIGHT,
        });
    }

    /**
     * Change the panel view
     */
    changeView(payload: ViewChangePayload): void {
        console.log('changeView called:', payload);
        if (this.panelWindow && this.panelWindow.isVisible()) {
            // Panel already visible, send immediately
            this.panelWindow.webContents.send('panel:change-view', payload);
        } else {
            // Panel not visible, queue it
            if (this.pendingViewChanges.length < MAX_PENDING_CHANGES) {
                this.pendingViewChanges.push(payload);
                console.log('[WindowManager] Queued view change. Queue length:', this.pendingViewChanges.length);
            } else {
                console.warn('[WindowManager] View change queue full, dropping oldest');
                this.pendingViewChanges.shift(); // Remove oldest
                this.pendingViewChanges.push(payload);
            }
        }
    }

    /**
     * Request session setup UI to be shown when panel opens
     */
    requestSessionSetup(): void {
        console.log('requestSessionSetup called');
        this.changeView({ view: 'session-setup' });
    }

    /**
     * Request settings UI to be shown when panel opens
     */
    requestSettings(): void {
        console.log('requestSettings called');
        this.changeView({ view: 'settings' });
    }

    /**
     * Request analysis view to be shown when panel opens
     */
    requestAnalysis(): void {
        console.log('requestAnalysis called');
        this.changeView({ view: 'analysis' });
    }

    /**
     * Show tasks view in the panel
     */
    showTasksView(): void {
        console.log('showTasksView called, showing panel and sending tasks view message');
        this.showPanel();
        this.changeView({ view: 'tasks' });
    }

    /**
     * Broadcast session state to all windows
     */
    broadcastSessionState(sessionState: SessionState): void {
        this.widgetWindow?.webContents.send('session:updated', sessionState);
        this.panelWindow?.webContents.send('session:updated', sessionState);
        this.sessionWidget?.webContents.send('session:updated', sessionState);
        this.mainWindow?.webContents.send('session:updated', sessionState);
    }

    /**
     * Trigger screenshot capture in widget window
     */
    triggerScreenshotCapture(): void {
        this.widgetWindow?.webContents.send('screenshot:capture');
    }

    /**
     * Send message to panel
     */
    sendToPanel(channel: string, ...args: any[]): void {
        this.panelWindow?.webContents.send(channel, ...args);
    }

    /**
     * Get widget window
     */
    getWidgetWindow(): BrowserWindow | null {
        return this.widgetWindow;
    }

    /**
     * Get panel window
     */
    getPanelWindow(): BrowserWindow | null {
        return this.panelWindow;
    }

    /**
     * Set widget window position based on preference
     */
    setWindowPosition(position: 'top-left' | 'top-center' | 'top-right', saveToConfig: boolean = true): void {
        if (!this.widgetWindow) return;

        // Store the current position for panel alignment
        this.currentPosition = position;

        // Save to config file for persistence across restarts
        if (saveToConfig) {
            this.configService.setWindowPosition(position);
        }

        const display = screen.getPrimaryDisplay();
        const { width: screenWidth } = display.workAreaSize;
        const { x: screenX, y: screenY } = display.workArea;

        let x: number;
        const y = screenY + WINDOW_MARGIN;

        switch (position) {
            case 'top-left':
                x = screenX + WINDOW_MARGIN;
                break;
            case 'top-center':
                x = screenX + Math.round((screenWidth - WIDGET_CIRCLE_SIZE) / 2);
                break;
            case 'top-right':
                x = screenX + screenWidth - WIDGET_CIRCLE_SIZE - WINDOW_MARGIN;
                break;
        }

        // Use setPosition instead of setBounds to avoid locking the window
        this.widgetWindow.setPosition(x, y);

        // Reposition panel if it's visible
        if (this.panelWindow && this.panelWindow.isVisible()) {
            this.positionPanelBelowWidget();
        }
    }

    /**
     * Close all windows
     */
    closeAll(): void {
        this.panelWindow?.close();
        this.widgetWindow?.close();
        this.mainWindow?.close();
        this.sessionWidget?.close();
        this.panelWindow = null;
        this.widgetWindow = null;
        this.mainWindow = null;
        this.sessionWidget = null;
    }
}
