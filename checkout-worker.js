const CATALOG = Object.freeze({
  blanket: { name: 'Meadow Bloom Blanket', description: 'Soft cotton · 34 × 42 in', unitAmount: 8600, image: 'assets/meadow-blanket.png' },
  star: { name: 'Wish Upon a Star Pillow', description: 'Plush cotton · 16 in', unitAmount: 4200, image: 'assets/star-pillow.png' },
  pup: { name: 'Honey Pup Keepsake', description: 'Cotton yarn · 12 in', unitAmount: 4800, image: 'assets/crochet-pup.png' },
  tote: { name: 'Sunday Market Tote', description: 'Washable cotton · roomy fit', unitAmount: 5400, image: 'assets/market-tote.png' },
});

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
});

function corsHeaders(request, env) {
  const origin = request.headers.get('origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || env.STOREFRONT_URL || '')
    .split(',')
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean);
  const normalizedOrigin = origin.replace(/\/$/, '');
  const localOrigin = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(normalizedOrigin) || origin === 'null';
  const approvedOrigin = allowed.includes(normalizedOrigin) || (env.ENVIRONMENT !== 'production' && localOrigin);

  return {
    'access-control-allow-origin': approvedOrigin ? origin : allowed[0] || 'null',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type, stripe-signature',
    vary: 'origin',
  };
}

function normalizeCart(input) {
  if (!Array.isArray(input) || input.length === 0 || input.length > Object.keys(CATALOG).length) {
    throw new Error('Your bag is empty or contains too many unique items.');
  }

  return input.map((item) => {
    const product = CATALOG[item?.id];
    const quantity = Number(item?.quantity);
    if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      throw new Error('One or more bag items are invalid.');
    }
    return { id: item.id, quantity, ...product };
  });
}

function absoluteUrl(base, path) {
  return new URL(path, `${base.replace(/\/$/, '')}/`).toString();
}

function isSandbox(env) {
  return env.ENVIRONMENT === 'sandbox' || env.ENVIRONMENT === 'test' || env.ENVIRONMENT === 'development';
}

async function recordOrder(env, event) {
  const session = event?.data?.object;
  if (!session?.id || !env.ORDERS) {
    console.log('Paid Corral Creations order', session?.id || 'unknown');
    return;
  }
  const id = env.ORDERS.idFromName(session.id);
  const stub = env.ORDERS.get(id);
  await stub.fetch('https://orders/record', {
    method: 'POST',
    body: JSON.stringify({
      eventId: event.id,
      eventType: event.type,
      receivedAt: new Date().toISOString(),
      session,
    }),
    headers: { 'content-type': 'application/json' },
  });
}

async function createCheckoutSession(request, env, headers) {
  if (!env.STRIPE_SECRET_KEY) return json({ error: 'Stripe checkout is not configured.' }, 503, headers);
  if (isSandbox(env) && !env.STRIPE_SECRET_KEY.startsWith('sk_test_')) {
    return json({ error: 'Sandbox checkout requires a Stripe test-mode secret key.' }, 503, headers);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'The checkout request was not valid JSON.' }, 400, headers);
  }

  let cart;
  try {
    cart = normalizeCart(body.items);
  } catch (error) {
    return json({ error: error.message }, 400, headers);
  }

  const storefrontUrl = (env.STOREFRONT_URL || '').replace(/\/$/, '');
  if (!storefrontUrl) return json({ error: 'The storefront URL is not configured.' }, 503, headers);

  const subtotal = cart.reduce((sum, item) => sum + item.unitAmount * item.quantity, 0);
  const shippingAmount = subtotal >= 7500 ? 0 : 800;
  const params = new URLSearchParams({
    mode: 'payment',
    success_url: `${storefrontUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}#shop`,
    cancel_url: `${storefrontUrl}/?checkout=cancelled#shop`,
    customer_creation: 'always',
    billing_address_collection: 'auto',
    'shipping_address_collection[allowed_countries][0]': 'US',
    'phone_number_collection[enabled]': 'true',
    allow_promotion_codes: 'true',
    'metadata[source]': 'corral-creations',
    'metadata[environment]': env.ENVIRONMENT || 'sandbox',
    'shipping_options[0][shipping_rate_data][type]': 'fixed_amount',
    'shipping_options[0][shipping_rate_data][fixed_amount][amount]': String(shippingAmount),
    'shipping_options[0][shipping_rate_data][fixed_amount][currency]': 'usd',
    'shipping_options[0][shipping_rate_data][display_name]': shippingAmount === 0 ? 'Free handmade-order shipping' : 'Standard shipping',
    'shipping_options[0][shipping_rate_data][delivery_estimate][minimum][unit]': 'business_day',
    'shipping_options[0][shipping_rate_data][delivery_estimate][minimum][value]': '5',
    'shipping_options[0][shipping_rate_data][delivery_estimate][maximum][unit]': 'business_day',
    'shipping_options[0][shipping_rate_data][delivery_estimate][maximum][value]': '8',
  });
  if (env.STRIPE_AUTOMATIC_TAX === 'true') params.set('automatic_tax[enabled]', 'true');

  cart.forEach((item, index) => {
    params.set(`line_items[${index}][price_data][currency]`, 'usd');
    params.set(`line_items[${index}][price_data][unit_amount]`, String(item.unitAmount));
    params.set(`line_items[${index}][price_data][product_data][name]`, item.name);
    params.set(`line_items[${index}][price_data][product_data][description]`, item.description);
    params.set(`line_items[${index}][price_data][product_data][images][0]`, absoluteUrl(storefrontUrl, item.image));
    params.set(`line_items[${index}][quantity]`, String(item.quantity));
    params.set(`line_items[${index}][adjustable_quantity][enabled]`, 'true');
    params.set(`line_items[${index}][adjustable_quantity][minimum]`, '1');
    params.set(`line_items[${index}][adjustable_quantity][maximum]`, '10');
  });

  const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'content-type': 'application/x-www-form-urlencoded',
      'idempotency-key': crypto.randomUUID(),
    },
    body: params,
  });
  const session = await stripeResponse.json();

  if (!stripeResponse.ok || !session.url) {
    console.error('Stripe Checkout Session error', session?.error?.type || stripeResponse.status);
    return json({ error: 'Stripe could not start checkout. Please try again.' }, 502, headers);
  }

  return json({ url: session.url }, 200, headers);
}

function hexToBytes(hex) {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2) return new Uint8Array();
  return new Uint8Array(hex.match(/.{2}/g).map((byte) => Number.parseInt(byte, 16)));
}

function timingSafeEqual(left, right) {
  const leftBytes = hexToBytes(left);
  const rightBytes = hexToBytes(right);
  if (leftBytes.length !== rightBytes.length || leftBytes.length === 0) return false;
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) difference |= leftBytes[index] ^ rightBytes[index];
  return difference === 0;
}

async function verifyStripeSignature(payload, signatureHeader, secret) {
  const parts = Object.fromEntries((signatureHeader || '').split(',').map((part) => part.split('=', 2)));
  const timestamp = Number(parts.t);
  if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > 300 || !parts.v1) return false;

  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`));
  const expected = [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return timingSafeEqual(expected, parts.v1);
}

async function handleWebhook(request, env) {
  if (!env.STRIPE_WEBHOOK_SECRET) return json({ error: 'Webhook verification is not configured.' }, 503);
  const payload = await request.text();
  if (!(await verifyStripeSignature(payload, request.headers.get('stripe-signature'), env.STRIPE_WEBHOOK_SECRET))) {
    return json({ error: 'Invalid webhook signature.' }, 400);
  }

  const event = JSON.parse(payload);
  if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
    await recordOrder(env, event);
  }
  return json({ received: true });
}

export class OrderLedger {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    if (request.method !== 'POST') return json({ error: 'Not found.' }, 404);
    const incoming = await request.json();
    const existing = await this.state.storage.get('order');
    if (existing?.eventId === incoming.eventId) return json({ received: true, duplicate: true });
    await this.state.storage.put('order', incoming);
    return json({ received: true });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = corsHeaders(request, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method === 'GET' && url.pathname === '/health') return json({ ok: true, stripe: Boolean(env.STRIPE_SECRET_KEY) }, 200, headers);
    if (request.method === 'POST' && url.pathname === '/checkout') return createCheckoutSession(request, env, headers);
    if (request.method === 'POST' && url.pathname === '/webhook') return handleWebhook(request, env);
    return json({ error: 'Not found.' }, 404, headers);
  },
};
