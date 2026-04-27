import type { GeminiModel } from "@/lib/settings/userSettings";

/**
 * Direct REST client for Google AI Studio Gemini. We avoid the SDK
 * (`@google/generative-ai`, ~50 KB gzipped) because we only need a
 * single endpoint and the request body is straightforward.
 */

const ENDPOINT = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

export interface AiChatMessage {
  role: "user" | "ai";
  text: string;
}

export interface GenerateAnswerArgs {
  apiKey: string;
  model: GeminiModel;
  /** Static system instruction (TYRO_AI_SYSTEM_PROMPT). */
  systemInstruction: string;
  /** Prior turns in the conversation (oldest → newest). Excludes
   *  the current `userPrompt`. */
  history: AiChatMessage[];
  /** The user's current message. */
  userPrompt: string;
}

/** A friendly Turkish error class so the UI can surface localized text
 *  without parsing strings. */
export class GeminiError extends Error {
  constructor(
    public readonly userMessage: string,
    public readonly cause?: unknown
  ) {
    super(userMessage);
    this.name = "GeminiError";
  }
}

interface GeminiPart {
  text: string;
}
interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}
interface GeminiRequestBody {
  contents: GeminiContent[];
  systemInstruction?: { parts: GeminiPart[] };
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
  };
}
interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; code?: number; status?: string };
}

/**
 * Fire a single chat turn at Gemini and return the model's text.
 * Throws `GeminiError` with a Turkish `userMessage` for any failure.
 */
export async function generateAnswer(args: GenerateAnswerArgs): Promise<string> {
  const { apiKey, model, systemInstruction, history, userPrompt } = args;

  if (!apiKey || !apiKey.trim()) {
    throw new GeminiError(
      "Gemini API key girilmemiş — Ayarlar sayfasından bir key ekleyin."
    );
  }

  const body: GeminiRequestBody = {
    contents: [
      ...history.map<GeminiContent>((m) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.text }],
      })),
      { role: "user", parts: [{ text: userPrompt }] },
    ],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 1024,
      topP: 0.9,
    },
  };

  let res: Response;
  try {
    res = await fetch(`${ENDPOINT(model)}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new GeminiError(
      "Gemini'ye bağlanılamadı. İnternet bağlantınızı kontrol edin.",
      err
    );
  }

  if (res.status === 401 || res.status === 403) {
    throw new GeminiError(
      "API key geçersiz görünüyor. Ayarlar > AI Chatbot'tan kontrol edin."
    );
  }
  if (res.status === 429) {
    throw new GeminiError(
      "Yoğunluk var — birkaç saniye sonra tekrar deneyin."
    );
  }

  let parsed: GeminiResponse;
  try {
    parsed = (await res.json()) as GeminiResponse;
  } catch (err) {
    throw new GeminiError("Gemini'den geçerli bir yanıt alınamadı.", err);
  }

  if (!res.ok || parsed.error) {
    const apiMsg = parsed.error?.message ?? `HTTP ${res.status}`;
    throw new GeminiError(`Gemini hatası: ${apiMsg}`, parsed.error);
  }

  // Safety / blocked-prompt handling
  const blockReason = parsed.promptFeedback?.blockReason;
  if (blockReason) {
    throw new GeminiError(
      "Bu konuda yanıt veremiyorum. Lütfen başka bir şekilde sorun."
    );
  }

  const candidate = parsed.candidates?.[0];
  if (!candidate) {
    throw new GeminiError("Gemini yanıt döndürmedi. Tekrar deneyin.");
  }
  if (candidate.finishReason === "SAFETY") {
    throw new GeminiError(
      "Bu konuda yanıt veremiyorum. Lütfen başka bir şekilde sorun."
    );
  }

  const text = candidate.content?.parts
    ?.map((p) => p.text ?? "")
    .filter(Boolean)
    .join("\n")
    .trim();

  if (!text) {
    throw new GeminiError("Gemini boş bir yanıt döndürdü. Tekrar deneyin.");
  }

  return text;
}
