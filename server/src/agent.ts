// Claude drafts contracts from a plain-English brief and explains verification results.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const client = new Anthropic();
const MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-5-5";

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
  })),
});
export type ContractDraft = z.infer<typeof ContractDraft>;

const DRAFT_SYSTEM = `You turn a client's job brief into an escrow contract for PactPay.
Split the work into 1-5 milestones whose amounts add up exactly to the budget.
Prefer checks a machine can verify: "github_ci" (worker submits a pull request; pays when CI passes),
"http" (worker deploys; pays when the URL responds as expected). Use "manual" only when nothing
can be checked automatically. Keep titles short. Use the budget's currency (default USD).`;

export async function draftContract(brief: string, budget: string): Promise<ContractDraft> {
  const res = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: "low", format: zodOutputFormat(ContractDraft) },
    system: DRAFT_SYSTEM,
    messages: [{ role: "user", content: `Budget: ${budget}\n\nBrief:\n${brief}` }],
  });
  if (res.stop_reason === "refusal" || !res.parsed_output) throw new Error("Claude could not draft this contract");
  return res.parsed_output;
}

export async function explainCheck(milestone: string, passed: boolean, summary: string, evidence: unknown): Promise<string> {
  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      output_config: { effort: "low" },
      system: "You are the escrow agent for PactPay. In two short sentences, tell the client and the worker what the verification found and what happens to the money next. Plain words, no markdown.",
      messages: [{
        role: "user",
        content: `Milestone: ${milestone}\nResult: ${passed ? "PASSED - funds will be released to the worker" : "FAILED - funds stay held"}\nSummary: ${summary}\nEvidence: ${JSON.stringify(evidence).slice(0, 6000)}`,
      }],
    });
    const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join(" ").trim();
    return text || summary;
  } catch {
    return summary; // explanation is a nice-to-have; never block the money flow on it
  }
}
