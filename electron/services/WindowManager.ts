import { app, BrowserWindow, screen } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SessionState } from '../types/session.types.js';
import type { ConfigService } from './ConfigService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CIRCLE_SIZE = 160;
const PANEL_WIDTH = 440;
const PANEL_HEIGHT = 380;

type ViewChangePayload = {
    view: 'session-setup' | 'settings' | 'tasks' | 'interruption-reflection' | 'distracted-reason' | 'analysis';
    data?: any;
};

export class WindowManager {
    private widgetWindow: BrowserWindow | null = null;
    private panelWindow: BrowserWindow | null = null;
    private preloadPath: string;
    private pendingViewChange: ViewChangePayload | null = null;
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
        const margin = 20;

        let x: number;
        const y = screenY + margin;

        switch (savedPosition) {
            case 'top-left':
                x = screenX + margin;
                break;
            case 'top-center':
                x = screenX + Math.round((screenWidth - CIRCLE_SIZE) / 2);
                break;
            case 'top-right':
                x = screenX + screenWidth - CIRCLE_SIZE - margin;
                break;
        }

        this.widgetWindow = new BrowserWindow({
            x,
            y,
            width: CIRCLE_SIZE,
            height: CIRCLE_SIZE,
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
        this.widgetWindow.setMinimumSize(CIRCLE_SIZE, CIRCLE_SIZE);
        this.widgetWindow.setMaximumSize(CIRCLE_SIZE, CIRCLE_SIZE);
        this.widgetWindow.setAspectRatio(1);

        // load renderer
        if (process.env.NODE_ENV !== 'production') {
            await this.widgetWindow.loadURL('http://localhost:5173');
            // DISABLED FOR DEMO
            // this.widgetWindow.webContents.openDevTools({ mode: 'detach' });
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
                if (this.pendingViewChange) {
                    console.log('Panel loaded, sending view change:', this.pendingViewChange);
                    this.panelWindow?.webContents.send('panel:change-view', this.pendingViewChange);
                    this.pendingViewChange = null;
                }
            });

            // load renderer
            if (process.env.NODE_ENV !== 'production') {
                this.panelWindow.loadURL('http://localhost:5173/#/panel');
                // DISABLED FOR DEMO
                // this.panelWindow.webContents.openDevTools({ mode: 'detach' });
            } else {
                this.panelWindow.loadURL(`file://${path.join(__dirname, '../../dist/index.html')}#/panel`);
            }
        } else if (this.pendingViewChange) {
            // Panel already exists and is loaded, send immediately
            console.log('Panel already loaded, sending view change immediately:', this.pendingViewChange);
            this.panelWindow.webContents.send('panel:change-view', this.pendingViewChange);
            this.pendingViewChange = null;
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
            // Reset pending view change if panel is hidden
            this.pendingViewChange = null;
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
            // Panel not visible, store for when it opens
            this.pendingViewChange = payload;
        }
    }

    /**
     * Request session setup UI to be shown when panel opens
     */
    requestSessionSetup(): void {
        console.log('requestSessionSetup called');
        this.pendingViewChange = { view: 'session-setup' };
    }

    /**
     * Request settings UI to be shown when panel opens
     */
    requestSettings(): void {
        console.log('requestSettings called');
        this.pendingViewChange = { view: 'settings' };
    }

    /**
     * Request analysis view to be shown when panel opens
     */
    requestAnalysis(): void {
        console.log('requestAnalysis called');
        this.pendingViewChange = { view: 'analysis' };
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

        const margin = 20; // Margin from screen edges
        let x: number;
        const y = screenY + margin;

        switch (position) {
            case 'top-left':
                x = screenX + margin;
                break;
            case 'top-center':
                x = screenX + Math.round((screenWidth - CIRCLE_SIZE) / 2);
                break;
            case 'top-right':
                x = screenX + screenWidth - CIRCLE_SIZE - margin;
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
        this.panelWindow = null;
        this.widgetWindow = null;
    }
}
