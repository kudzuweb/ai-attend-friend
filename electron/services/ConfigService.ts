import { app } from 'electron';
import fs from 'fs';
import path from 'path';

interface AppConfig {
    windowPosition?: 'top-left' | 'top-center' | 'top-right';
}

export class ConfigService {
    private configPath: string;
    private config: AppConfig = {};

    constructor() {
        const userDataPath = app.getPath('userData');
        this.configPath = path.join(userDataPath, 'config.json');
        this.loadConfig();
    }

    private loadConfig(): void {
        try {
            if (fs.existsSync(this.configPath)) {
                const data = fs.readFileSync(this.configPath, 'utf-8');
                this.config = JSON.parse(data);
            }
        } catch (error) {
            console.error('Failed to load config:', error);
            this.config = {};
        }
    }

    private saveConfig(): void {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
        } catch (error) {
            console.error('Failed to save config:', error);
        }
    }

    getWindowPosition(): 'top-left' | 'top-center' | 'top-right' {
        return this.config.windowPosition || 'top-right';
    }

    setWindowPosition(position: 'top-left' | 'top-center' | 'top-right'): void {
        this.config.windowPosition = position;
        this.saveConfig();
    }
}
