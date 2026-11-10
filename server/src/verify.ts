// Deterministic milestone checks. The AI never decides whether money moves:
// these checks do. The AI only explains the result.
export interface CheckResult {
  passed: boolean;
  summary: string;      // one-line, machine-written
  evidence: unknown;    // raw facts shown in the dashboard and fed to the explainer
}

const gh = async (path: string) => {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "pactpay-verifier",
      ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`GitHub ${path} -> ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<any>;
};

/** Passes when every check run and commit status on the PR's head commit succeeded. */
export async function checkGithubCi(prUrl: string, cfg: { require_merged?: boolean; repo?: string }): Promise<CheckResult> {
  const m = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!m) return { passed: false, summary: "Submission is not a GitHub pull request URL", evidence: { prUrl } };
  const [, owner, repo, num] = m;
  try {
    // The PR must be in the repository the contract names, or any green PR on GitHub would get paid.
    const expected = (cfg.repo ?? "").trim().replace(/^https?:\/\/github\.com\//, "").replace(/\.git$|\/$/g, "").toLowerCase();
    if (expected && expected !== `${owner}/${repo}`.toLowerCase())
      return { passed: false, summary: `PR is in ${owner}/${repo}, but this contract is for ${expected}`, evidence: { prUrl, expectedRepo: expected } };
    const pr = await gh(`/repos/${owner}/${repo}/pulls/${num}`);
    const sha: string = pr.head?.sha;
    if (!sha) return { passed: false, summary: "Could not resolve head commit SHA on pull request", evidence: { prUrl } };
    const [runs, status] = await Promise.all([
      gh(`/repos/${owner}/${repo}/commits/${sha}/check-runs?per_page=100`),
      gh(`/repos/${owner}/${repo}/commits/${sha}/status`),
    ]);
    const checkRuns = (runs.check_runs as any[] || []).map((r) => ({ name: r.name, status: r.status, conclusion: r.conclusion, url: r.html_url }));
    const statuses = (status.statuses as any[] || []).map((s) => ({ context: s.context, state: s.state, url: s.target_url }));
    const evidence = { pr: { url: pr.html_url, title: pr.title, sha, merged: pr.merged, state: pr.state }, checkRuns, statuses };

    if (!checkRuns.length && !statuses.length)
      return { passed: false, summary: "No CI checks ran on this pull request", evidence };
    const pending = checkRuns.filter((r) => r.status !== "completed").length + statuses.filter((s) => s.state === "pending").length;
    if (pending) return { passed: false, summary: `${pending} CI check(s) still running`, evidence: { ...evidence, pending: true } };
    const failed = [
      ...checkRuns.filter((r) => !["success", "neutral", "skipped"].includes(r.conclusion)).map((r) => r.name),
      ...statuses.filter((s) => s.state !== "success").map((s) => s.context),
    ];
    if (failed.length) return { passed: false, summary: `CI failed: ${[...new Set(failed)].join(", ")}`, evidence };
    if (cfg.require_merged && !pr.merged) return { passed: false, summary: "CI passed but the PR is not merged yet", evidence };
    return { passed: true, summary: `All ${checkRuns.length + statuses.length} CI checks passed on ${sha.slice(0, 7)}`, evidence };
  } catch (e) {
    return { passed: false, summary: `Could not verify GitHub CI: ${(e as Error).message}`, evidence: { prUrl, error: (e as Error).message } };
  }
}

/** Passes when the deployed URL answers with the expected status (and text, if set). */
export async function checkHttp(url: string, cfg: { expect_status?: number; expect_text?: string }): Promise<CheckResult> {
  const expectStatus = cfg.expect_status ?? 200;
  const started = Date.now();
  try {
    new URL(url); // validate URL syntax
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000), redirect: "follow" });
    const body = await res.text();
    const evidence = { url, status: res.status, ms: Date.now() - started, bodyPreview: body.slice(0, 300) };
    if (res.status !== expectStatus) return { passed: false, summary: `Expected HTTP ${expectStatus}, got ${res.status}`, evidence };
    if (cfg.expect_text && !body.includes(cfg.expect_text))
      return { passed: false, summary: `Response did not contain "${cfg.expect_text}"`, evidence };
    return { passed: true, summary: `${url} answered ${res.status} in ${evidence.ms} ms`, evidence };
  } catch (e) {
    return { passed: false, summary: `Could not reach ${url}: ${(e as Error).message}`, evidence: { url } };
  }
}

export async function runCheck(type: string, configJson: any, submission: string): Promise<CheckResult> {
  let cfg: any = {};
  try {
    cfg = typeof configJson === "string" ? JSON.parse(configJson || "{}") : (configJson || {});
  } catch {
    cfg = {};
  }
  if (type === "github_ci") return checkGithubCi(submission, cfg);
  if (type === "http") return checkHttp(cfg.url ?? submission, cfg);
  return { passed: false, summary: "Manual milestone: waiting for the client to approve", evidence: { submission } };
}
