import { app } from 'electron';
import fs from 'fs';
import path from 'path';

interface AppConfig {
    windowPosition?: 'top-left' | 'top-center' | 'top-right';
    demoMode?: boolean;
    tasksEnabled?: boolean;
    version?: number;
    completedTaskVisibility?: 'immediate' | 'end-of-session' | 'end-of-day';
    endOfDayTime?: string;
    deletedTaskRetention?: '1day' | '7days' | '30days';
    useNewArchitecture?: boolean;
}

export class ConfigService {
    private configPath: string;
    private config: AppConfig = {};

    constructor() {
        const userDataPath = app.getPath('userData');
        this.configPath = path.join(userDataPath, 'config.json');
        console.log('[ConfigService] Config path:', this.configPath);
        this.loadConfig();
    }

    private loadConfig(): void {
        try {
            if (fs.existsSync(this.configPath)) {
                const data = fs.readFileSync(this.configPath, 'utf-8');
                this.config = JSON.parse(data);
                console.log('[ConfigService] Config loaded:', this.config);
            } else {
                console.log('[ConfigService] No existing config file, using defaults');
                this.config = {};
            }
        } catch (error) {
            console.error('[ConfigService] Failed to load config:', error);
            this.config = {};
        }
    }

    private saveConfig(): void {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
            console.log('[ConfigService] Config saved:', this.config);
        } catch (error) {
            console.error('[ConfigService] Failed to save config:', error);
        }
    }

    getWindowPosition(): 'top-left' | 'top-center' | 'top-right' {
        return this.config.windowPosition || 'top-right';
    }

    setWindowPosition(position: 'top-left' | 'top-center' | 'top-right'): void {
        this.config.windowPosition = position;
        this.saveConfig();
    }

    getDemoMode(): boolean {
        return this.config.demoMode ?? true;
    }

    setDemoMode(enabled: boolean): void {
        this.config.demoMode = enabled;
        this.saveConfig();
    }

    getTasksEnabled(): boolean {
        return this.config.tasksEnabled ?? true;
    }

    setTasksEnabled(enabled: boolean): void {
        this.config.tasksEnabled = enabled;
        this.saveConfig();
    }

    getAllSettings(): { windowPosition: 'top-left' | 'top-center' | 'top-right'; demoMode: boolean; tasksEnabled: boolean } {
        return {
            windowPosition: this.getWindowPosition(),
            demoMode: this.getDemoMode(),
            tasksEnabled: this.getTasksEnabled(),
        };
    }

    updateSettings(partial: { demoMode?: boolean; tasksEnabled?: boolean }): { windowPosition: 'top-left' | 'top-center' | 'top-right'; demoMode: boolean; tasksEnabled: boolean } {
        if (partial.demoMode !== undefined) {
            this.config.demoMode = partial.demoMode;
        }
        if (partial.tasksEnabled !== undefined) {
            this.config.tasksEnabled = partial.tasksEnabled;
        }
        this.saveConfig();
        return this.getAllSettings();
    }

    get<K extends keyof AppConfig>(key: K): AppConfig[K] {
        return this.config[key];
    }

    set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
        this.config[key] = value;
        this.saveConfig();
    }

    getAll(): AppConfig {
        return { ...this.config };
    }
}
