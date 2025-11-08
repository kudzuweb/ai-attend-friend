import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SessionState } from '../types/session.types.js';

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
    private isPanelReady: boolean = false;

    constructor() {
        // absolute path to built preload
        this.preloadPath = path.resolve(__dirname, '../../electron/preload.js');
    }

    /**
     * Called by IPC handler when panel signals it's ready
     */
    onPanelReady(): void {
        console.log('[WindowManager] Panel is ready');
        this.isPanelReady = true;

        // Send pending view change if we have one
        if (this.pendingViewChange && this.panelWindow) {
            console.log('[WindowManager] Sending pending view change:', this.pendingViewChange);
            this.panelWindow.webContents.send('panel:change-view', this.pendingViewChange);
            this.pendingViewChange = null;
        }

        // Show panel
        if (this.panelWindow) {
            this.positionPanelBelowWidget();
            this.panelWindow.show();
        }
    }

    /**
     * Create the circular widget window
     */
    async createWidgetWindow(): Promise<BrowserWindow> {
        console.log("createWidgetWindow() called at", new Date());

        this.widgetWindow = new BrowserWindow({
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
            this.widgetWindow.webContents.openDevTools({ mode: 'detach' });
        } else {
            await this.widgetWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
        }

        this.widgetWindow.setBounds({
            width: CIRCLE_SIZE,
            height: CIRCLE_SIZE,
            x: this.widgetWindow.getBounds().x,
            y: this.widgetWindow.getBounds().y
        });

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
            // Create panel window for the first time
            this.isPanelReady = false;
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

            // load renderer - panel will signal when ready
            if (process.env.NODE_ENV !== 'production') {
                this.panelWindow.loadURL('http://localhost:5173/#/panel');
                this.panelWindow.webContents.openDevTools({ mode: 'detach' });
            } else {
                this.panelWindow.loadURL(`file://${path.join(__dirname, '../../dist/index.html')}#/panel`);
            }
            // Note: Panel will be shown when it sends 'panel:ready' signal
        } else if (this.isPanelReady) {
            // Panel already exists and is ready
            if (this.pendingViewChange) {
                // Send view change immediately
                console.log('Panel already loaded, sending view change immediately:', this.pendingViewChange);
                this.panelWindow.webContents.send('panel:change-view', this.pendingViewChange);
                this.pendingViewChange = null;
            }
            // Show panel
            this.positionPanelBelowWidget();
            this.panelWindow.show();
        }
        // else: Panel exists but not ready yet - will show when ready signal arrives
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
     * Position panel centered below widget
     */
    private positionPanelBelowWidget(): void {
        if (!this.widgetWindow || !this.panelWindow) return;

        const parentBounds = this.widgetWindow.getBounds();
        const centeredX = parentBounds.x + (parentBounds.width - PANEL_WIDTH) / 2;

        this.panelWindow.setBounds({
            x: Math.round(centeredX),
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
     * Close all windows
     */
    closeAll(): void {
        this.panelWindow?.close();
        this.widgetWindow?.close();
        this.panelWindow = null;
        this.widgetWindow = null;
    }
}
