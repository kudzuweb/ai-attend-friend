import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

export class ScreenshotService {
    private captureTimer: NodeJS.Timeout | null = null;

    /**
     * Get the captures directory path
     */
    private getCapturesDir(): string {
        return path.join(app.getPath('userData'), 'captures');
    }

    /**
     * Create ISO filenames with colons replaced
     */
    private dateTimeStamp(d = new Date()): string {
        return d.toISOString().replace(/:/g, '-');
    }

    /**
     * Create short SHA for filenames to distinguish images taken close together
     */
    private shortSha(buffer: Buffer, n = 8): string {
        return crypto.createHash('sha256').update(buffer).digest('hex').slice(0, n);
    }

    /**
     * Parse data URL to extract buffer and metadata
     */
    private parseDataUrl(dataUrl: string): { buffer: Buffer; ext: string; mime: `image/${string}` } {
        const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
        if (!m) throw new Error('invalid_data_url');
        const mime = m[1] as `image/${string}`;
        const buffer = Buffer.from(m[2], 'base64');
        let ext: string;
        if (mime === 'image/jpeg') {
            ext = '.jpg';
        } else {
            throw new Error('invalid_image_type');
        }
        return { buffer, ext, mime };
    }

    /**
     * Atomically save screenshot to disk
     */
    private async atomicScreenshotSave(finalPath: string, buffer: Buffer): Promise<void> {
        await fs.mkdir(path.dirname(finalPath), { recursive: true });
        const tmp = finalPath + '.tmp';

        // create temp file; fail if exists, recover by OVERWRITING
        await fs.writeFile(tmp, buffer, { flag: 'wx' }).catch(async (e) => {
            if (e?.code === 'EEXIST') {
                await fs.writeFile(tmp, buffer);
            } else {
                throw e;
            }
        });

        await fs.rename(tmp, finalPath);
    }

    /**
     * Save a screenshot from a data URL
     */
    async saveScreenshot(dataUrl: string, capturedAt: string): Promise<{
        ok: true;
        file: string;
        deduped: boolean;
        bytes: number;
        capturedAt: string;
        sha: string;
        mime: string;
    } | {
        ok: false;
        error: string;
    }> {
        try {
            const d = new Date(capturedAt);
            // decode base64
            const { buffer, ext, mime } = this.parseDataUrl(dataUrl);

            // create filename and path
            const timeStamp = this.dateTimeStamp(d);
            const sha = this.shortSha(buffer);
            const baseDir = this.getCapturesDir();
            await fs.mkdir(baseDir, { recursive: true });
            const filePath = path.join(baseDir, `${sha}${ext}`);

            await this.atomicScreenshotSave(filePath, buffer);

            return {
                ok: true as const,
                file: filePath,
                deduped: false,
                bytes: buffer.byteLength,
                capturedAt: d.toISOString(),
                sha: sha,
                mime: mime,
            };
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            return {
                ok: false as const,
                error: msg
            };
        }
    }

    /**
     * Get the N most recent screenshot file paths
     */
    async getRecentScreenshots(limit = 10): Promise<string[]> {
        const dir = this.getCapturesDir();
        const entries = await fs.readdir(dir).catch(() => []);
        const files = entries
            .filter(f => /\.(jpg|jpeg)$/i.test(f))
            .map(f => path.join(dir, f));
        if (files.length === 0) return [];

        // extract timestamps from metadata
        const getTimeStamps = await Promise.all(
            files.map(async f => ({ f, t: (await fs.stat(f)).mtime.getTime() }))
        );

        return getTimeStamps
            .sort((a, b) => b.t - a.t)
            .slice(0, limit)
            .map(x => x.f);
    }

    /**
     * Convert file path to base64 data URL
     */
    async fileToDataUrl(file: string): Promise<string> {
        const buffer = await fs.readFile(file);
        const mime = 'image/jpeg';
        return `data:${mime};base64,${buffer.toString('base64')}`;
    }

    /**
     * Delete all screenshots captured during a session
     */
    async deleteSessionScreenshots(sessionStartTime: number, sessionEndTime: number): Promise<void> {
        try {
            const dir = this.getCapturesDir();
            const entries = await fs.readdir(dir).catch(() => []);
            const jpgFiles = entries.filter(f => /\.(jpg|jpeg)$/i.test(f));

            // Get file timestamps and delete those within session time range
            const filesToDelete = await Promise.all(
                jpgFiles.map(async f => {
                    const filePath = path.join(dir, f);
                    const stat = await fs.stat(filePath).catch(() => null);
                    if (!stat) return null;

                    const fileTime = stat.mtime.getTime();
                    // Include file if it was created during or just after session (some buffer for last capture)
                    if (fileTime >= sessionStartTime && fileTime <= sessionEndTime + 5000) {
                        return filePath;
                    }
                    return null;
                })
            );

            // Delete files asynchronously without blocking
            filesToDelete.filter(Boolean).forEach(filePath => {
                fs.unlink(filePath!).catch(err => {
                    console.error(`Failed to delete screenshot ${filePath}:`, err);
                });
            });
        } catch (err) {
            console.error('Error cleaning up session screenshots:', err);
        }
    }

    /**
     * Start periodic screenshot capture timer
     * Note: This doesn't actually capture - it relies on renderer process
     */
    startCaptureTimer(intervalMs: number, callback: () => void): void {
        // First capture after initial delay
        const firstScreenshotTime = 30_000;

        this.captureTimer = setTimeout(() => {
            callback();

            // Then schedule subsequent captures
            this.captureTimer = setInterval(() => {
                callback();
            }, intervalMs);
        }, firstScreenshotTime);
    }

    /**
     * Stop the screenshot capture timer
     */
    stopCaptureTimer(): void {
        if (this.captureTimer) {
            clearTimeout(this.captureTimer);
            clearInterval(this.captureTimer);
            this.captureTimer = null;
        }
    }
}
