import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { generatedPaperSchema } from '@vedaai/shared';
import type { AssignmentInput, GeneratedPaper, QuestionConfig } from '@vedaai/shared';
import { env } from '../config/env';

// ─── Error Types ─────────────────────────────────────────────────────────────

class AIServiceError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AIServiceError';
  }
}

// ─── Prompt Construction ─────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert educator and exam paper generator. You must return only valid JSON with no markdown formatting, no code blocks, no explanation text. The JSON must exactly match the schema provided.`;

function buildUserPrompt(
  input: AssignmentInput,
  assignmentId: string,
  paperId: string,
): string {
  const questionReqs = input.questionConfigs
    .map(
      (qc: QuestionConfig, i: number) =>
        `  ${i + 1}. ${qc.count} ${qc.type.replace('_', ' ')} questions, ${qc.marksPerQuestion} marks each, difficulty: ${qc.difficulty}`,
    )
    .join('\n');

  let prompt = `Generate an exam paper with the following details:

Title: ${input.title}
Subject: ${input.subject}
Grade: ${input.grade}
School Name: ${input.schoolName}
Total Marks: ${input.totalMarks}
Duration: ${input.duration} minutes

Question Requirements:
${questionReqs}

Group questions into sections by type:
- Section A for the first question type
- Section B for the second question type
- And so on...

Each section must include:
- A title (e.g., "Section A - Multiple Choice Questions")
- An instruction line (e.g., "Choose the correct option for each question.")
- The total marks for that section

For MCQ questions, provide exactly 4 options.
Every question must have an answerKey.`;

  if (input.additionalInstructions) {
    prompt += `\n\nAdditional Instructions:\n${input.additionalInstructions}`;
  }

  if (input.uploadedFileContent) {
    prompt += `\n\nReference Material:\n${input.uploadedFileContent}`;
  }

  prompt += `\n\nReturn the result as a JSON object with this exact structure:
{
  "id": "${paperId}",
  "assignmentId": "${assignmentId}",
  "schoolName": "${input.schoolName}",
  "subject": "${input.subject}",
  "grade": "${input.grade}",
  "duration": ${input.duration},
  "totalMarks": ${input.totalMarks},
  "sections": [
    {
      "id": "unique-section-id",
      "title": "Section A - ...",
      "instruction": "...",
      "questionType": "mcq|short_answer|long_answer|true_false",
      "questions": [
        {
          "id": "unique-question-id",
          "text": "question text",
          "type": "mcq|short_answer|long_answer|true_false",
          "difficulty": "easy|medium|hard",
          "marks": number,
          "options": ["A", "B", "C", "D"],
          "answerKey": "correct answer"
        }
      ],
      "totalMarks": number
    }
  ],
  "createdAt": "${new Date().toISOString()}"
}`;

  return prompt;
}

// ─── Provider Implementations ────────────────────────────────────────────────

let currentKeyIndex = 0;

const GROQ_KEYS = Array.from(
  new Set([
    env.GROQ_API_KEY,
    ...(env.GROQ_API_KEYS
      ? env.GROQ_API_KEYS.split(',').map((k) => k.trim())
      : []),
  ]),
).filter(Boolean);

async function callGroq(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  if (GROQ_KEYS.length === 0) {
    throw new AIServiceError('No Groq API keys available', 'groq');
  }

  let attempts = 0;
  let lastError: any = null;

  while (attempts < GROQ_KEYS.length) {
    const key = GROQ_KEYS[currentKeyIndex];
    try {
      console.log(`[AI Engine] Attempting Groq call with key index ${currentKeyIndex}...`);
      const client = new OpenAI({
        apiKey: key,
        baseURL: 'https://api.groq.com/openai/v1',
      });

      const response = await client.chat.completions.create({
        model: env.GROQ_MODEL || 'openai/gpt-oss-120b',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 8192,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new AIServiceError('No content in Groq response', 'groq');
      }

      return content;
    } catch (error: any) {
      lastError = error;
      attempts++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`[AI Engine] Groq API call failed with key index ${currentKeyIndex}. Error: ${errorMessage}`);
      
      // Rotate to next key index
      currentKeyIndex = (currentKeyIndex + 1) % GROQ_KEYS.length;
      console.log(`[AI Engine] Rotating to Groq key index ${currentKeyIndex}`);
    }
  }

  throw new AIServiceError(
    `All Groq API keys exhausted. Last error: ${lastError?.message || lastError}`,
    'groq',
    lastError
  );
}

// ─── JSON Extraction ─────────────────────────────────────────────────────────

function extractJSON(text: string): string {
  // Try to extract JSON from markdown code blocks if present
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // Try to find a JSON object directly
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }

  return text.trim();
}

// ─── Main Service ────────────────────────────────────────────────────────────

export async function generatePaper(
  input: AssignmentInput,
  assignmentId: string,
): Promise<GeneratedPaper> {
  const paperId = uuidv4();

  const systemPrompt = SYSTEM_PROMPT;
  const userPrompt = buildUserPrompt(input, assignmentId, paperId);

  // First attempt
  let rawText: string;
  try {
    rawText = await callGroq(systemPrompt, userPrompt);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    throw new AIServiceError(
      `AI provider groq failed: ${message}`,
      'groq',
      error,
    );
  }

  const jsonString = extractJSON(rawText);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    // JSON parse failure — retry with correction prompt
    return retryWithCorrection(
      systemPrompt,
      `The previous response was not valid JSON. Please return ONLY a valid JSON object with no markdown formatting, no code blocks, no explanation. Original request:\n\n${userPrompt}`,
    );
  }

  const result = generatedPaperSchema.safeParse(parsed);
  if (result.success) {
    return result.data;
  }

  // Validation failure — retry with correction prompt including Zod error
  const zodErrors = result.error.issues
    .map((i: any) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n');

  return retryWithCorrection(
    systemPrompt,
    `The previous response had validation errors:\n${zodErrors}\n\nPlease fix these issues and return ONLY valid JSON. Original request:\n\n${userPrompt}`,
  );
}

async function retryWithCorrection(
  systemPrompt: string,
  correctionPrompt: string,
): Promise<GeneratedPaper> {
  let rawText: string;
  try {
    rawText = await callGroq(systemPrompt, correctionPrompt);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    throw new AIServiceError(
      `AI provider groq failed on retry: ${message}`,
      'groq',
      error,
    );
  }

  const jsonString = extractJSON(rawText);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new AIServiceError(
      `AI provider groq returned invalid JSON even after retry`,
      'groq',
    );
  }

  const result = generatedPaperSchema.safeParse(parsed);
  if (result.success) {
    return result.data;
  }

  const zodErrors = result.error.issues
    .map((i: any) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n');

  throw new AIServiceError(
    `AI response failed validation after retry. Errors:\n${zodErrors}`,
    'groq',
  );
}
