// Gemini drafts contracts from a plain-English brief and explains verification results.
// Keys come from GEMINI_API_KEYS (comma-separated); on a quota or auth error we rotate to the next one.
import { GoogleGenAI, ApiError } from "@google/genai";
import { z } from "zod";

// Tried in order: a busy model (503) falls through to the next one.
const MODELS = (process.env.GEMINI_MODELS ?? "gemini-3.5-flash-lite,gemini-3.8-flash,gemini-3.1-flash-lite")
  .split(",").map((m) => m.trim()).filter(Boolean);
const KEYS = (process.env.GEMINI_API_KEYS ?? process.env.GEMINI_API_KEY ?? "")
  .split(",").map((k) => k.trim()).filter(Boolean);
let keyIndex = 0;

export const aiConfigured = () => KEYS.length > 0;

async function generate(system: string, prompt: string, jsonSchema?: unknown): Promise<string> {
  if (!KEYS.length) throw new Error("GEMINI_API_KEYS is not set");
  let lastErr: unknown;
  for (const model of MODELS) {
    for (let attempt = 0; attempt < KEYS.length; attempt++) {
      const ai = new GoogleGenAI({
        apiKey: KEYS[keyIndex],
        apiVersion: "v1beta",
        httpOptions: { timeout: 30_000, retryOptions: { attempts: 1 } }, // we do our own fallback
      });
      try {
        const res = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction: system,
            ...(jsonSchema ? { responseMimeType: "application/json", responseJsonSchema: jsonSchema } : {}),
          },
        });
        const text = res.text?.trim();
        if (!text) throw new Error("Gemini returned an empty response");
        return text;
      } catch (e) {
        lastErr = e;
        const status = e instanceof ApiError ? e.status : 0;
        if ([401, 403, 429].includes(status)) {
          console.warn(`[gemini] key #${keyIndex + 1} failed (${status}); rotating`);
          keyIndex = (keyIndex + 1) % KEYS.length;
          continue;
        }
        if ([404, 500, 502, 503, 504].includes(status) || !(e instanceof ApiError)) {
          console.warn(`[gemini] ${model} unavailable (${status}); trying next model`);
          break;
        }
        throw e;
      }
    }
  }
  throw lastErr;
}

export const ContractDraft = z.object({
  title: z.string(),
  description: z.string(),
  currency: z.string(),
  milestones: z.array(z.object({
    title: z.string(),
    amount: z.string().describe("Decimal string with 2 places, e.g. \"150.00\""),
    check_type: z.enum(["github_ci", "http", "manual"]),
    check_config: z.object({
      require_merged: z.boolean().optional(),
      url: z.string().optional(),
      expect_status: z.number().optional(),
      expect_text: z.string().optional(),
    }),
    acceptance: z.string().describe("One sentence: what must be true for this milestone to pay out"),
  })).min(1),
});
export type ContractDraft = z.infer<typeof ContractDraft>;

const DRAFT_SYSTEM = `You turn a client's job brief into an escrow contract for PactPay.
Split the work into 1-5 milestones whose amounts add up exactly to the budget.
Prefer checks a machine can verify: "github_ci" (worker submits a pull request; pays when CI passes),
"http" (worker deploys; pays when the URL responds as expected, put the URL in check_config.url if known).
Use "manual" only when nothing can be checked automatically. Leave require_merged false unless the brief asks for a merge. Keep titles short.
Use the budget's currency (default USD).`;

export async function draftContract(brief: string, budget: string): Promise<ContractDraft> {
  const text = await generate(DRAFT_SYSTEM, `Budget: ${budget}\n\nBrief:\n${brief}`, z.toJSONSchema(ContractDraft));
  return ContractDraft.parse(JSON.parse(text));
}

export async function explainCheck(milestone: string, passed: boolean, summary: string, evidence: unknown): Promise<string> {
  if (!KEYS.length) return summary;
  try {
    return await generate(
      "You are the escrow agent for PactPay. In two short sentences, tell the client and the worker what the verification found and what happens to the money next. Plain words, no markdown.",
      `Milestone: ${milestone}\nResult: ${passed ? "PASSED - funds will be released to the worker" : "FAILED - funds stay held"}\nSummary: ${summary}\nEvidence: ${JSON.stringify(evidence).slice(0, 6000)}`,
    );
  } catch {
    return summary; // explanation is a nice-to-have; never block the money flow on it
  }
}
