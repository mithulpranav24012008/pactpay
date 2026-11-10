// Thin client over the PayPal REST APIs we use: Orders v2 (authorize), Payments v2
// (capture / void an authorization) and Payouts v1.
const BASE = process.env.PAYPAL_API_BASE ?? "https://api-m.sandbox.paypal.com";

let cached: { token: string; expires: number } | null = null;

async function token(): Promise<string> {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const id = process.env.PAYPAL_CLIENT_ID, secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are not set");
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new PayPalError("oauth", res.status, await res.text());
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: json.access_token, expires: Date.now() + json.expires_in * 1000 };
  return cached.token;
}

export class PayPalError extends Error {
  constructor(public op: string, public status: number, public body: string) {
    super(`PayPal ${op} failed (${status}): ${body.slice(0, 500)}`);
  }
}

async function call<T>(op: string, method: string, path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await token()}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(idempotencyKey ? { "PayPal-Request-Id": idempotencyKey } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new PayPalError(op, res.status, text);
  return (text ? JSON.parse(text) : {}) as T;
}

interface Link { href: string; rel: string }

/** Create an order the client approves; funds are authorized (held), not captured. */
export async function createEscrowOrder(opts: {
  contractId: string; description: string; currency: string; total: string; returnUrl: string; cancelUrl: string;
}) {
  const order = await call<{ id: string; links: Link[] }>("create order", "POST", "/v2/checkout/orders", {
    intent: "AUTHORIZE",
    purchase_units: [{
      reference_id: opts.contractId,
      description: opts.description.slice(0, 127),
      amount: { currency_code: opts.currency, value: opts.total },
    }],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: "PactPay Escrow",
          user_action: "CONTINUE",
          shipping_preference: "NO_SHIPPING",
          return_url: opts.returnUrl,
          cancel_url: opts.cancelUrl,
        },
      },
    },
  }, `order-${opts.contractId}`);
  const approve = order.links.find((l) => l.rel === "payer-action" || l.rel === "approve");
  if (!approve) throw new Error("PayPal order has no approval link");
  return { orderId: order.id, approveUrl: approve.href };
}

export async function authorizeOrder(orderId: string) {
  const res = await call<any>("authorize order", "POST", `/v2/checkout/orders/${orderId}/authorize`, {}, `auth-${orderId}`);
  const auth = res.purchase_units?.[0]?.payments?.authorizations?.[0];
  if (!auth?.id) throw new Error("Authorization id missing from PayPal response");
  return { authorizationId: auth.id as string, status: auth.status as string, expires: auth.expiration_time as string };
}

/** Capture part of the held funds for one milestone. */
export async function captureMilestone(authorizationId: string, currency: string, amount: string, finalCapture: boolean, milestoneId: string) {
  const res = await call<{ id: string; status: string }>(
    "capture", "POST", `/v2/payments/authorizations/${authorizationId}/capture`,
    { amount: { currency_code: currency, value: amount }, final_capture: finalCapture, invoice_id: milestoneId },
    `capture-${milestoneId}`,
  );
  return { captureId: res.id, status: res.status };
}

/** Release whatever is still held back to the client. */
export async function voidAuthorization(authorizationId: string) {
  await call("void", "POST", `/v2/payments/authorizations/${authorizationId}/void`, undefined, `void-${authorizationId}`);
}

/** Pay the worker their share of a captured milestone. */
export async function payoutToWorker(opts: { milestoneId: string; email: string; currency: string; amount: string; note: string }) {
  const res = await call<{ batch_header: { payout_batch_id: string; batch_status: string } }>(
    "payout", "POST", "/v1/payments/payouts",
    {
      sender_batch_header: {
        sender_batch_id: `pactpay-${opts.milestoneId}`,
        email_subject: "PactPay: milestone payment released",
        email_message: opts.note.slice(0, 255),
      },
      items: [{
        recipient_type: "EMAIL",
        receiver: opts.email,
        amount: { currency: opts.currency, value: opts.amount },
        note: opts.note.slice(0, 4000),
        sender_item_id: opts.milestoneId,
      }],
    },
    `payout-${opts.milestoneId}`,
  );
  return { batchId: res.batch_header.payout_batch_id, status: res.batch_header.batch_status };
}

export const paypalConfigured = () => Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
