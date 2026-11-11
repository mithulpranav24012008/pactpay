// PayPal: Orders + Payments via the official Server SDK; Payouts via REST (the SDK has no Payouts controller).
import {
  Client, Environment, OrdersController, PaymentsController, ApiError,
  CheckoutPaymentIntent, PaypalExperienceUserAction, PaypalWalletContextShippingPreference,
} from "@paypal/paypal-server-sdk";

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


let sdk: { orders: OrdersController; payments: PaymentsController } | null = null;
function controllers() {
  if (sdk) return sdk;
  const client = new Client({
    clientCredentialsAuthCredentials: {
      oAuthClientId: process.env.PAYPAL_CLIENT_ID ?? "",
      oAuthClientSecret: process.env.PAYPAL_CLIENT_SECRET ?? "",
    },
    environment: BASE.includes("sandbox") ? Environment.Sandbox : Environment.Production,
    timeout: 30_000,
  });
  sdk = { orders: new OrdersController(client), payments: new PaymentsController(client) };
  return sdk;
}

async function viaSdk<T>(op: string, fn: () => Promise<{ result: T }>): Promise<T> {
  if (!paypalConfigured()) throw new Error("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are not set");
  try {
    return (await fn()).result;
  } catch (e) {
    if (e instanceof ApiError) throw new PayPalError(op, e.statusCode, typeof e.body === "string" ? e.body : JSON.stringify(e.result ?? e.body));
    throw e;
  }
}

/** Create an order the client approves; funds are authorized (held), not captured. */
export async function createEscrowOrder(opts: {
  contractId: string; description: string; currency: string; total: string; returnUrl: string; cancelUrl: string;
}) {
  const order = await viaSdk("create order", () => controllers().orders.createOrder({
    paypalRequestId: `order-${opts.contractId}`,
    prefer: "return=representation",
    body: {
      intent: CheckoutPaymentIntent.Authorize,
      purchaseUnits: [{
        referenceId: opts.contractId,
        description: opts.description.slice(0, 127),
        amount: { currencyCode: opts.currency, value: opts.total },
      }],
      paymentSource: {
        paypal: {
          experienceContext: {
            brandName: "PactPay Escrow",
            userAction: PaypalExperienceUserAction.Continue,
            shippingPreference: PaypalWalletContextShippingPreference.NoShipping,
            returnUrl: opts.returnUrl,
            cancelUrl: opts.cancelUrl,
          },
        },
      },
    },
  }));
  const approve = order.links?.find((l) => l.rel === "payer-action" || l.rel === "approve");
  if (!order.id || !approve) throw new Error("PayPal order has no approval link");
  return { orderId: order.id, approveUrl: approve.href };
}

export async function authorizeOrder(orderId: string) {
  const res = await viaSdk("authorize order", () => controllers().orders.authorizeOrder({
    id: orderId, paypalRequestId: `auth-${orderId}`, prefer: "return=representation",
  }));
  const auth = res.purchaseUnits?.[0]?.payments?.authorizations?.[0];
  if (!auth?.id) throw new Error("Authorization id missing from PayPal response");
  return { authorizationId: auth.id, status: String(auth.status), expires: auth.expirationTime };
}

/** Capture part of the held funds for one milestone. */
export async function captureMilestone(authorizationId: string, currency: string, amount: string, finalCapture: boolean, milestoneId: string) {
  const res = await viaSdk("capture", () => controllers().payments.captureAuthorizedPayment({
    authorizationId,
    paypalRequestId: `capture-${milestoneId}`,
    prefer: "return=representation",
    body: { amount: { currencyCode: currency, value: amount }, finalCapture, invoiceId: milestoneId },
  }));
  return { captureId: res.id ?? "", status: String(res.status) };
}

/** Release whatever is still held back to the client. */
export async function voidAuthorization(authorizationId: string) {
  await viaSdk("void", () => controllers().payments.voidPayment({ authorizationId, paypalRequestId: `void-${authorizationId}` }));
}

/** Pay the worker their share of a captured milestone. */
/** Pay the worker to their PayPal email, or to their Venmo account by US phone number. */
export async function payoutToWorker(opts: {
  milestoneId: string; currency: string; amount: string; note: string;
  rail?: "paypal" | "venmo"; email?: string; venmoPhone?: string | null;
}) {
  const recipient = opts.rail === "venmo"
    ? { recipient_type: "PHONE", receiver: opts.venmoPhone, recipient_wallet: "VENMO" }
    : { recipient_type: "EMAIL", receiver: opts.email };
  const res = await call<{ batch_header: { payout_batch_id: string; batch_status: string } }>(
    "payout", "POST", "/v1/payments/payouts",
    {
      sender_batch_header: {
        sender_batch_id: `pactpay-${opts.milestoneId}`,
        email_subject: "PactPay: milestone payment released",
        email_message: opts.note.slice(0, 255),
      },
      items: [{
        ...recipient,
        amount: { currency: opts.currency, value: opts.amount },
        note: opts.note.slice(0, 4000),
        sender_item_id: opts.milestoneId,
      }],
    },
    `payout-${opts.milestoneId}`,
  );
  return { batchId: res.batch_header.payout_batch_id, status: res.batch_header.batch_status };
}

/** Check confirmation status of a PayPal payout batch. */
export async function getPayoutBatch(payoutBatchId: string) {
  return await call<{
    batch_header: { payout_batch_id: string; batch_status: string; time_created?: string; time_completed?: string };
    items?: Array<{ payout_item_id: string; transaction_status: string; payout_item_fee?: { value: string } }>;
  }>("payout-status", "GET", `/v1/payments/payouts/${payoutBatchId}`);
}

/** Where a payout actually stands at PayPal: SUCCESS, PENDING, UNCLAIMED, FAILED, RETURNED... */
export async function payoutStatus(batchId: string) {
  const res = await call<any>("payout status", "GET", `/v1/payments/payouts/${batchId}`);
  const item = res.items?.[0];
  return { batch: String(res.batch_header?.batch_status ?? "UNKNOWN"), item: String(item?.transaction_status ?? "UNKNOWN") };
}

export const paypalConfigured = () => Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
