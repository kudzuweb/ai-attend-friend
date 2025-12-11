import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { StorageService } from './StorageService.js';
import type { TaskStorage } from './TaskStorage.js';
import type { JournalStorage } from './JournalStorage.js';
import type { ConfigService } from './ConfigService.js';
import type { StoredSession } from '../types/session.types.js';

export class DataMigrationService {
    private migrationFlagPath: string;

    constructor(
        private storageService: StorageService,
        private taskStorage: TaskStorage,
        private journalStorage: JournalStorage,
        private configService: ConfigService
    ) {
        this.migrationFlagPath = path.join(app.getPath('userData'), '.migrated-v2');
    }

    async runMigrations(): Promise<void> {
        // Check if migration already completed
        try {
            await fs.access(this.migrationFlagPath);
            console.log('[Migration] Already migrated');
            return;
        } catch {
            // Not migrated yet
        }

        console.log('[Migration] Starting data migration...');

        // Create backup
        await this.createBackup();

        // Run migrations
        await this.migrateSessionTasks();
        await this.migrateReflectionsToJournal();
        await this.migrateConfig();

        // Mark as migrated
        await fs.writeFile(this.migrationFlagPath, new Date().toISOString(), 'utf-8');

        console.log('[Migration] Migration complete');
    }

    private async createBackup(): Promise<void> {
        const backupDir = path.join(app.getPath('userData'), 'backup-pre-v2');
        await fs.mkdir(backupDir, { recursive: true });

        const userDataPath = app.getPath('userData');

        // Backup sessions
        const sessionsPath = path.join(userDataPath, 'sessions');
        try {
            await fs.cp(sessionsPath, path.join(backupDir, 'sessions'), { recursive: true });
        } catch (e) {
            console.log('[Migration] No sessions to backup');
        }

        // Backup config
        const configPath = path.join(userDataPath, 'config.json');
        try {
            await fs.copyFile(configPath, path.join(backupDir, 'config.json'));
        } catch (e) {
            console.log('[Migration] No config to backup');
        }

        console.log('[Migration] Backup created at:', backupDir);
    }

    private async getAllSessionsFlat(): Promise<StoredSession[]> {
        const sessionsByDate = await this.storageService.listAllSessions();
        const allSessions: StoredSession[] = [];

        for (const dateFolder in sessionsByDate) {
            allSessions.push(...sessionsByDate[dateFolder]);
        }

        return allSessions;
    }

    private async migrateSessionTasks(): Promise<void> {
        // Get all sessions
        const sessions = await this.getAllSessionsFlat();

        let migratedCount = 0;

        for (const session of sessions) {
            // Check if session has old task format
            const oldTasks = (session as any).tasks as [string, string, string] | undefined;

            if (oldTasks && Array.isArray(oldTasks)) {
                // Convert old string tuple to Task objects
                const taskIds: string[] = [];

                for (let i = 0; i < oldTasks.length; i++) {
                    const content = oldTasks[i];
                    if (!content || !content.trim()) continue;

                    const task = await this.taskStorage.createTask({
                        content: content.trim(),
                        parentTaskId: null,
                        sourceLoopId: undefined,
                    });

                    // Associate with this session
                    await this.taskStorage.addSessionToTask(task.id, session.id);

                    taskIds.push(task.id);
                }

                // Update session with new task IDs
                // Note: We're modifying the session object but the StorageService
                // doesn't have an updateSession method, so we'll just track this
                // for future sessions. Old sessions will keep their old format.
                console.log(`[Migration] Session ${session.id}: migrated ${taskIds.length} tasks`);
                migratedCount++;
            }
        }

        console.log(`[Migration] Session tasks migrated (${migratedCount} sessions)`);
    }

    private async migrateReflectionsToJournal(): Promise<void> {
        const sessions = await this.getAllSessionsFlat();

        let migratedCount = 0;

        for (const session of sessions) {
            const reflections = (session as any).reflections as any[] | undefined;

            if (reflections && reflections.length > 0) {
                for (const reflection of reflections) {
                    // Create journal entry from reflection
                    await this.journalStorage.createEntry({
                        content: reflection.content || reflection.reason || '',
                        sessionId: session.id,
                    });
                }

                console.log(`[Migration] Session ${session.id}: migrated ${reflections.length} reflections to journal`);
                migratedCount += reflections.length;
            }
        }

        console.log(`[Migration] Reflections migrated to journal (${migratedCount} entries)`);
    }

    private async migrateConfig(): Promise<void> {
        // Add new config fields with defaults
        const existingConfig = await this.configService.getAll();

        if (!existingConfig.version) {
            await this.configService.set('version', 2);
        }

        if (!existingConfig.completedTaskVisibility) {
            await this.configService.set('completedTaskVisibility', 'end-of-day');
        }

        if (!existingConfig.endOfDayTime) {
            await this.configService.set('endOfDayTime', '04:00');
        }

        if (!existingConfig.deletedTaskRetention) {
            await this.configService.set('deletedTaskRetention', '7days');
        }

        console.log('[Migration] Config migrated');
    }
}
