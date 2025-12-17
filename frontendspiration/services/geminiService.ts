import { GoogleGenAI, Type } from "@google/genai";
import { Task, AIAnalysisResult } from "../types";

const getAIClient = () => {
  // In a real Electron app, this would get the key via IPC from the main process
  // For this demo, we assume it's available in env
  const apiKey = process.env.API_KEY || ''; 
  if (!apiKey) {
    console.warn("API_KEY not found in environment variables");
  }
  return new GoogleGenAI({ apiKey });
};

export const analyzeTasks = async (tasks: Task[], focusGoal: string): Promise<AIAnalysisResult> => {
  const ai = getAIClient();
  
  const prompt = `
    I have a session goal: "${focusGoal}".
    Here are my tasks: ${JSON.stringify(tasks)}.
    
    Please provide a short, motivating suggestion on how to tackle these tasks during my session.
    Also, if necessary, reorder the tasks or flag high priority ones based on the goal.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestion: { type: Type.STRING },
            revisedTasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  completed: { type: Type.BOOLEAN },
                  priority: { type: Type.STRING, enum: ["low", "medium", "high"] }
                }
              }
            }
          }
        }
      }
    });

    if (response.text) {
        return JSON.parse(response.text) as AIAnalysisResult;
    }
    throw new Error("No response text");

  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return {
      suggestion: "Let's stay focused! Pick one task and start.",
      revisedTasks: tasks
    };
  }
};