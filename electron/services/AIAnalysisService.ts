import { app } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import type { AnalysisResult, SessionInterruption, DistractionReason, Reflection } from '../types/session.types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class AIAnalysisService {
    private apiKey: string;
    private baseUrl: string;
    private model: string;
    private systemPromptText: string | null = null;
    private sessionFinalizePromptText: string | null = null;

    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY || '';
        this.baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com').replace(/\/+$/, '');
        this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    }

    /**
     * Resolve prompt file path from various possible locations
     */
    private async resolvePromptPath(input: string): Promise<string> {
        if (path.isAbsolute(input)) {
            return input;
        }

        const filepathCandidates = [
            // dev: next to source
            path.join(__dirname, '..', '..', input),
            path.join(__dirname, '..', '..', '..', input),
            // dev: project root cwd
            path.join(process.cwd(), input),
            // electron app root (dev: project dir; prod: app.asar)
            path.join(app.getAppPath(), input),
            // packaged app Resources
            path.join(process.resourcesPath, input),
        ];

        for (const abs of filepathCandidates) {
            try {
                await fs.access(abs);
                return abs;
            } catch { }
        }
        throw new Error(
            `prompt not found. tried:\n${filepathCandidates.join('\n')}\n`
        );
    }

    /**
     * Load a prompt from a file
     */
    private async loadPrompt(promptPath: string): Promise<string> {
        const abs = await this.resolvePromptPath(promptPath);
        const content = await fs.readFile(abs, 'utf8');
        if (!content.trim()) throw new Error(`prompt file is empty: ${abs}`);
        return content;
    }

    /**
     * Initialize prompts - must be called before using the service
     */
    async initialize(): Promise<void> {
        this.systemPromptText = await this.loadPrompt('src/prompts/screenshot-analysis.md');
        this.sessionFinalizePromptText = await this.loadPrompt('src/prompts/session-finalize.md');
    }

    /**
     * Analyze recent screenshots and determine focus status
     */
    async analyzeScreenshots(
        dataUrls: string[],
        focusGoal: string = '',
        tasks?: [string, string, string]
    ): Promise<{
        ok: true;
        structured: AnalysisResult;
        raw: any;
        count: number;
    } | {
        ok: false;
        error: string;
    }> {
        if (!this.apiKey) {
            return {
                ok: false as const,
                error: 'missing_api_key'
            };
        }

        if (!this.systemPromptText) {
            return {
                ok: false as const,
                error: 'prompts not initialized'
            };
        }

        if (dataUrls.length === 0) {
            return {
                ok: false as const,
                error: 'no images'
            };
        }

        // Build context text with focus goal and tasks
        let contextText = '';
        if (focusGoal) {
            contextText += `The user's focus goal for this session: "${focusGoal}"\n`;
        }
        if (tasks && tasks.some(t => t.trim())) {
            const taskList = tasks.filter(t => t.trim()).map((t, i) => `${i + 1}. ${t}`).join('\n');
            contextText += `Tasks they planned to work on:\n${taskList}\n`;
        }
        contextText += '\nThese screenshots portray the last five minutes of activity:';

        const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: this.model,
                temperature: 0,
                response_format: {
                    type: 'json_schema',
                    json_schema: {
                        name: 'focus_assessment',
                        schema: {
                            type: 'object',
                            properties: {
                                status: {
                                    type: 'string',
                                    enum: ['focused', 'distracted'],
                                },
                            },
                            required: ['status'],
                            additionalProperties: false,
                        },
                    },
                },
                messages: [{
                    'role': 'system',
                    'content': this.systemPromptText,
                },
                {
                    'role': 'user',
                    'content': [
                        {
                            'type': 'text',
                            'text': contextText
                        },
                        ...dataUrls.map(url => ({
                            'type': 'image_url',
                            'image_url': { url, detail: 'low' }
                        })),
                    ],
                },
                ],
            }),
        });

        const responseString = await res.json().catch(() => null);
        console.log('analyzeScreenshots responseString:', responseString);

        const content = responseString?.choices?.[0]?.message?.content;
        console.log('analyzeScreenshots content:', content);

        let structured: any = null;

        try {
            structured = JSON.parse(content);
        } catch {
            throw new Error('could not parse llm response to json');
        }

        console.log('analyzeScreenshots structured:', structured);
        return {
            ok: true as const,
            structured: structured,
            raw: responseString,
            count: dataUrls.length
        };
    }

    /**
     * Generate final summary from session analyses
     */
    async generateFinalSummary(
        summaries: string[],
        interruptions: SessionInterruption[] = [],
        distractions: DistractionReason[] = [],
        reflections: Reflection[] = [],
        focusGoal: string = ''
    ): Promise<string | null> {
        if (summaries.length === 0) {
            return null;
        }

        if (!this.apiKey) return null;

        if (!this.sessionFinalizePromptText) {
            console.error('Session finalize prompt not initialized');
            return null;
        }

        const summaryText = summaries.map((s, i) => `${i + 1}. ${s}`).join('\n');

        let focusGoalText = '';
        if (focusGoal) {
            focusGoalText = `\n\nUser's stated focus goal at the start of the session: "${focusGoal}"`;
        }

        let interruptionText = '';
        if (interruptions.length > 0) {
            interruptionText = '\n\nInterruptions during the session:\n' + interruptions.map((int, i) => {
                const duration = Math.round(int.durationMs / 60000); // convert to minutes
                const reflection = int.userReflection || 'no reflection provided';
                return `${i + 1}. System went to sleep for ${duration} minutes. User noted: "${reflection}"`;
            }).join('\n');
        }

        let distractionText = '';
        if (distractions.length > 0) {
            distractionText = '\n\nDistraction reasons during the session:\n' + distractions.map((dist, i) => {
                return `${i + 1}. User noted: "${dist.userReason}"`;
            }).join('\n');
        }

        let reflectionText = '';
        if (reflections.length > 0) {
            reflectionText = '\n\nDeeper reflections during the session:\n' + reflections.map((ref, i) => {
                return `${i + 1}. User reflected: "${ref.content}"`;
            }).join('\n');
        }

        const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: this.model,
                temperature: 0,
                messages: [{
                    'role': 'system',
                    'content': this.sessionFinalizePromptText,
                },
                {
                    'role': 'user',
                    'content': `here are the analyses from a completed work session:${focusGoalText}\n\n${summaryText}${interruptionText}${distractionText}${reflectionText}`,
                },
                ],
            }),
        });

        const responseString = await res.json().catch(() => null);
        const content = responseString?.choices?.[0]?.message?.content;

        if (!content) {
            console.error('failed to generate final summary');
            return null;
        }

        return content;
    }
}
