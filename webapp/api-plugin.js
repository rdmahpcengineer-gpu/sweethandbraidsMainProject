import { loadEnv } from 'vite';
import Stripe from 'stripe';

/* ═══════════════════════════════════════════════════════════════════
   SweetHandBraids — Local API Plugin for Vite Dev Server
   Handles: /webhook/web-chat-intake, /webhook/create-video-room,
            /webhook/vapi-server-url, /api/create-checkout-session,
            /api/stripe-webhook

   This replaces the n8n webhook layer for local development.
   In production, these endpoints are served by n8n workflows.

   AI priority: OpenAI → Gemini → Smart Fallback
   ═══════════════════════════════════════════════════════════════════ */

const sessions = new Map();

/** Lazy Stripe instance */
let _stripe;
function getStripe(env) {
  if (!_stripe) {
    if (!env.STRIPE_SECRET_KEY || env.STRIPE_SECRET_KEY === 'sk_test_PLACEHOLDER') {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    _stripe = new Stripe(env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

/** Read raw body as Buffer (needed for Stripe webhook signature verification) */
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk.toString()));
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
  });
}

function json(res, data, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

/* ─── STYLE CATALOG ─── */
const STYLES = {
  knotless_box_braids: { label: 'Knotless Box Braids', time: '4-8 hrs', price: '$150-350', desc: 'lightweight, natural-looking box braids without the knot at the root — super gentle on your edges' },
  goddess_locs:        { label: 'Goddess Locs', time: '5-8 hrs', price: '$180-350', desc: 'beautiful, bohemian-style faux locs with curly ends — gives you that effortless goddess energy' },
  passion_twists:      { label: 'Passion Twists', time: '3-6 hrs', price: '$140-280', desc: 'soft, fluffy twists with a romantic look — super popular and low-maintenance' },
  butterfly_locs:      { label: 'Butterfly Locs', time: '5-8 hrs', price: '$180-320', desc: 'distressed faux locs with a unique textured look — absolutely stunning' },
  cornrows:            { label: 'Feed-In Cornrows', time: '2-5 hrs', price: '$80-200', desc: 'sleek braids flat to the scalp — classic, versatile, and protective' },
  fulani_braids:       { label: 'Fulani Braids', time: '3-6 hrs', price: '$120-250', desc: 'cornrow patterns inspired by Fulani culture with gorgeous detail — total head-turner' },
  tribal_braids:       { label: 'Tribal Braids', time: '4-7 hrs', price: '$150-300', desc: 'bold, artistic cornrow patterns — each one is a unique work of art' },
  crochet_braids:      { label: 'Crochet Braids', time: '2-4 hrs', price: '$80-180', desc: 'quick install using the crochet method — tons of style options and super versatile' },
};

const SYSTEM_PROMPT = `You are SweetHand, the AI hair braiding stylist at Sweet Hand Braids salon.

PERSONALITY:
- Warm, confident, knowledgeable — like a best friend who is also an expert braider
- Use natural, friendly language with a warm, uplifting tone
- Be enthusiastic about hair — you LOVE what you do
- Give honest advice with kindness
- Use occasional emojis naturally but don't overdo it

SERVICES & PRICING:
- Knotless Box Braids: 4-8 hrs, $150-350
- Goddess Locs: 5-8 hrs, $180-350
- Passion Twists: 3-6 hrs, $140-280
- Butterfly Locs: 5-8 hrs, $180-320
- Feed-In Cornrows: 2-5 hrs, $80-200
- Fulani Braids: 3-6 hrs, $120-250
- Tribal Braids: 4-7 hrs, $150-300
- Crochet Braids: 2-4 hrs, $80-180

RULES:
1. Keep responses to 2-4 sentences. Be concise but warm.
2. If they ask about a specific style, mention estimated time and price range.
3. If they want to book, ask for: preferred style, date, and time.
4. If they describe their hair or share a photo, give personalized recommendations.
5. Always end with a clear next step or question.
6. For pricing questions, give ranges and explain what affects the price.
7. Be supportive of all hair textures and types.`;

/* ─── SMART FALLBACK RESPONDER ─── */
function smartFallback(message, customerName, messageType, styleId, history) {
  const msg = (message || '').toLowerCase();
  const name = customerName?.split(' ')[0] || 'love';

  // Style selection
  if (messageType === 'style_selection' || styleId) {
    const style = STYLES[styleId] || Object.values(STYLES).find(s => msg.includes(s.label.toLowerCase()));
    if (style) {
      return `Ooh, great choice! ${style.label} are absolutely gorgeous — ${style.desc}! They typically take ${style.time} and run ${style.price} depending on length and size. Want me to check our availability so we can get you booked? 💕`;
    }
  }

  // Photo/video analysis
  if (messageType === 'video_frame') {
    return `Thanks for sharing that photo, ${name}! Based on what I can see, I'd love to recommend a few styles. For a protective look, Knotless Box Braids ($150-350) would be gorgeous. If you want something more bohemian, Goddess Locs ($180-350) would look amazing on you! What style catches your eye? ✨`;
  }

  // Greeting patterns
  if (/^(hi|hey|hello|hola|what'?s? ?up|yo|good (morning|afternoon|evening)|sup|how are|howdy|greetings)/i.test(msg) || msg.length < 15 && /^(hi|hey|hello|yo|sup|what)/i.test(msg)) {
    return `Hey ${name}! Welcome to Sweet Hand Braids! I'm your AI stylist and I'm so excited to help you find your perfect look. Are you thinking braids, locs, twists, or cornrows today? ✨`;
  }

  // Pricing questions
  if (/price|cost|how much|expensive|cheap|afford|rate|charge/i.test(msg)) {
    const matchedStyle = Object.values(STYLES).find(s => msg.includes(s.label.toLowerCase().split(' ')[0]));
    if (matchedStyle) {
      return `${matchedStyle.label} run ${matchedStyle.price} — the final price depends on your hair length, the braid size, and any extras like color or beads. The install takes about ${matchedStyle.time}. Want to know more details or ready to book? 💕`;
    }
    return `Our prices range from $80 for cornrows up to $350 for longer goddess locs or box braids. It all depends on the style, length, and thickness you want! Which style has your attention? I can give you an exact quote. ✨`;
  }

  // Booking intent
  if (/book|appointment|schedule|reserve|available|when|slot|opening/i.test(msg)) {
    return `I'd love to get you booked! To find the perfect time, I need three things:\n\n1. Which style are you going for?\n2. What date works best for you?\n3. Do you prefer morning or afternoon?\n\nOnce I have that, I'll check our availability! 📅`;
  }

  // Style listing / what do you offer
  if (/style|offer|menu|service|option|do you (have|do)|what (kind|type)|list/i.test(msg)) {
    const list = Object.values(STYLES).map(s => `• ${s.label} (${s.time}, ${s.price})`).join('\n');
    return `Here are our styles, ${name}! Each one is installed with love and care:\n\n${list}\n\nWhich one is calling your name? Or tap the Styles button to browse! 💕`;
  }

  // Aftercare (check BEFORE generic style keywords)
  if (/\b(care|maintain|last|keep|wash|sleep|edge|protect)\b/i.test(msg) && !/want|interested|get me|book|how much|price/i.test(msg)) {
    return `Great question about aftercare! Here are my top tips:\n\n• Wrap your hair in a silk/satin bonnet at night\n• Moisturize your scalp 2-3x per week\n• Avoid heavy products on the braids\n• Most styles last 4-8 weeks with proper care\n\nWant me to tell you more about maintaining a specific style? 💕`;
  }

  // Duration / time questions
  if (/how long|duration|hour|take|sit/i.test(msg) && /style|braid|loc|twist|cornrow|install/i.test(msg)) {
    return `Install times vary by style — cornrows can be as quick as 2 hours, while goddess locs or butterfly locs might take 5-8 hours for a full head. I always make sure you're comfortable with snack breaks! Which style are you considering? I'll give you a more exact estimate. ⏰`;
  }

  // Specific style mentions (fuzzy keyword match)
  for (const [id, style] of Object.entries(STYLES)) {
    const keywords = style.label.toLowerCase().split(' ');
    // Require a more specific match: at least one keyword > 4 chars that isn't just "braids"
    if (keywords.some(k => k.length > 4 && k !== 'braids' && msg.includes(k))) {
      return `${style.label} are one of my favorites! ${style.desc}. They take about ${style.time} and run ${style.price}. Would you like to book this style or need more info about the process? ✨`;
    }
  }

  // Hair type / recommendation
  if (/recommend|suggest|which|what should|best for|my hair|hair type|natural|4[abc]|3[abc]|thick|thin|fine|coarse/i.test(msg)) {
    return `Great question! Every hair type is beautiful and I have the perfect style for you. For a protective, low-tension option I'd recommend Knotless Box Braids. If you want something quick and trendy, Passion Twists are gorgeous! Want to send me a photo of your hair so I can give you more personalized recommendations? 📸`;
  }

  // Thank you / positive
  if (/thank|thanks|appreciate|love it|great|awesome|perfect|amazing/i.test(msg)) {
    return `Aww, you're so welcome, ${name}! I'm here for you whenever you need style advice or want to book. Is there anything else I can help you with today? 💕✨`;
  }

  // Cancel / reschedule
  if (/cancel|reschedule|change|move|different (time|date|day)/i.test(msg)) {
    return `No worries at all, ${name}! To update your appointment, just let me know your new preferred date and time and I'll take care of it. Or if you need to cancel, I totally understand — we can always rebook when you're ready! 💕`;
  }

  // Location
  if (/where|location|address|directions|find you|come/i.test(msg)) {
    return `We'd love to have you! You can visit us at our salon — the exact address is on our website at sweethandbraids.com. We're easy to find and there's parking available! Want me to help you book a visit? 📍`;
  }

  // Default / catch-all
  const fallbacks = [
    `That's a great question, ${name}! I'm your braiding expert and I'd love to help. Are you looking to explore our styles, get a recommendation, or book an appointment? ✨`,
    `I hear you, ${name}! Let me help you with that. Would you like to browse our styles, get a personalized recommendation, or jump straight to booking? 💕`,
    `Love the enthusiasm, ${name}! I'm here to make sure you leave looking and feeling amazing. What's on your mind — styles, pricing, or booking? ✨`,
  ];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

/* ─── AI API CALL (OpenAI → Gemini → Fallback) ─── */
async function callAI(env, message, customerName, messageType, styleId, history) {
  // Try OpenAI first
  if (env.OPENAI_API_KEY) {
    try {
      const contextMessages = [
        { role: 'system', content: SYSTEM_PROMPT + (customerName ? `\n\nCurrent customer: ${customerName}` : '') },
        ...history.slice(-40).filter(m => m.content != null && m.content !== ''),
      ];
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENAI_API_KEY}` },
        body: JSON.stringify({ model: 'gpt-4o', messages: contextMessages, temperature: 0.7, max_tokens: 500 }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content;
        if (text) { console.log('[SHB] OpenAI responded'); return text; }
      } else {
        const errBody = await res.text().catch(() => '');
        console.warn('[SHB] OpenAI error:', res.status, errBody.slice(0, 200));
      }
    } catch (e) { console.warn('[SHB] OpenAI failed:', e.message); }
  }

  // Try Gemini
  if (env.GEMINI_API_KEY) {
    try {
      // Gemini requires first message to be 'user' and alternating roles
      let geminiHistory = history.slice(-20).map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
      // Ensure first message is from user and list is non-empty
      while (geminiHistory.length && geminiHistory[0].role !== 'user') geminiHistory.shift();
      // Remove consecutive same-role messages
      geminiHistory = geminiHistory.filter((m, i) => i === 0 || m.role !== geminiHistory[i - 1].role);
      if (!geminiHistory.length) geminiHistory = [{ role: 'user', parts: [{ text: message }] }];
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT + (customerName ? `\n\nCurrent customer: ${customerName}` : '') }] },
            contents: geminiHistory,
            generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
          }),
          signal: AbortSignal.timeout(15000),
        },
      );
      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) { console.log('[SHB] Gemini responded'); return text; }
      } else {
        console.warn('[SHB] Gemini error:', res.status);
      }
    } catch (e) { console.warn('[SHB] Gemini failed:', e.message); }
  }

  // Smart fallback — always works
  console.log('[SHB] Using smart fallback');
  return smartFallback(message, customerName, messageType, styleId, history);
}

export default function sweetHandBraidsApi() {
  let env;

  return {
    name: 'sweethandbraids-api',

    config(_, { mode }) {
      env = loadEnv(mode, process.cwd(), '');
    },

    configureServer(server) {
      /* ─── POST /webhook/web-chat-intake ─── */
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname !== '/webhook/web-chat-intake' || req.method !== 'POST') return next();

        try {
          const body = await parseBody(req);
          const { session_id, customer_name, message = '', message_type, style_id } = body;

          if (!sessions.has(session_id)) sessions.set(session_id, []);
          const history = sessions.get(session_id);

          // Build user message with context
          let userContent = message || '';
          if (message_type === 'style_selection' && style_id) {
            userContent = `I'm interested in ${style_id.replace(/_/g, ' ')}. ${message}`;
          } else if (message_type === 'video_frame') {
            userContent = `[Customer shared a photo/video frame for hair analysis] ${message}`;
          }

          history.push({ role: 'user', content: userContent });

          // Call AI (OpenAI → Gemini → Smart fallback)
          const responseText = await callAI(env, message, customer_name, message_type, style_id, history);

          history.push({ role: 'assistant', content: responseText });

          // Trim session history
          if (history.length > 60) sessions.set(session_id, history.slice(-40));

          json(res, {
            response: responseText,
            images: [],
            booking_prompt: null,
            session_id,
          });
        } catch (err) {
          console.error('[SHB API] Chat error:', err.message);
          json(res, { response: "Something went wrong on my end — try again! 💕", session_id: '' }, 200);
        }
      });

      /* ─── POST /webhook/create-video-room ─── */
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname !== '/webhook/create-video-room' || req.method !== 'POST') return next();

        try {
          const body = await parseBody(req);
          const roomName = `shb-${body.session_id || Date.now()}`.slice(0, 40);

          // Create Daily.co room
          const roomRes = await fetch('https://api.daily.co/v1/rooms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.DAILY_API_KEY}` },
            body: JSON.stringify({
              name: roomName,
              privacy: 'private',
              properties: {
                max_participants: 2, enable_recording: 'cloud', enable_chat: false,
                exp: Math.floor(Date.now() / 1000) + 3600,
                eject_at_room_exp: true, start_video_off: false, start_audio_off: false,
              },
            }),
          });

          if (!roomRes.ok) {
            const errBody = await roomRes.text();
            console.error('[SHB API] Daily.co room error:', roomRes.status, errBody);
            return json(res, { error: 'Failed to create video room' }, 500);
          }

          const roomData = await roomRes.json();

          // Create meeting token
          const tokenRes = await fetch('https://api.daily.co/v1/meeting-tokens', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.DAILY_API_KEY}` },
            body: JSON.stringify({
              properties: {
                room_name: roomData.name,
                user_name: body.customer_name || 'Customer',
                enable_recording: 'cloud',
                exp: Math.floor(Date.now() / 1000) + 3600,
              },
            }),
          });

          if (!tokenRes.ok) {
            console.error('[SHB API] Daily.co token error:', tokenRes.status);
            return json(res, { error: 'Failed to create meeting token' }, 500);
          }

          const tokenData = await tokenRes.json();

          json(res, {
            room_url: roomData.url,
            token: tokenData.token,
            room_name: roomData.name,
            expires_at: new Date(Date.now() + 3600000).toISOString(),
          });
        } catch (err) {
          console.error('[SHB API] Video room error:', err.message);
          json(res, { error: 'Failed to create video room' }, 500);
        }
      });

      /* ─── POST /webhook/vapi-server-url ─── */
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname !== '/webhook/vapi-server-url' || req.method !== 'POST') return next();

        try {
          const body = await parseBody(req);
          const messageType = body.message?.type || 'unknown';

          if (messageType === 'assistant-request') {
            json(res, {
              assistant: {
                firstMessage: "Hey love! Welcome to Sweet Hand Braids! What style are you thinking about?",
                model: {
                  provider: 'openai', model: 'gpt-4o', temperature: 0.7, maxTokens: 250,
                  systemMessage: SYSTEM_PROMPT,
                },
                voice: { provider: '11labs', voiceId: 'EXAVITQu4vr4xnSDxMaL' },
                silenceTimeoutSeconds: 30,
                maxDurationSeconds: 600,
                endCallFunctionEnabled: true,
              },
            });
          } else if (messageType === 'function-call') {
            const funcName = body.message?.functionCall?.name;
            const params = body.message?.functionCall?.parameters || {};
            console.log(`[SHB API] VAPI function call: ${funcName}`, params);
            json(res, { result: JSON.stringify({ status: 'ok', message: `Function ${funcName} handled` }) });
          } else {
            json(res, { status: 'ok' });
          }
        } catch (err) {
          console.error('[SHB API] VAPI handler error:', err.message);
          json(res, { status: 'error' }, 500);
        }
      });

      /* ─── POST /api/create-checkout-session ─── */
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname !== '/api/create-checkout-session' || req.method !== 'POST') return next();

        try {
          const stripe = getStripe(env);
          const body = await parseBody(req);
          const { service, customerName, customerEmail, customerPhone, date } = body;

          if (!service || !customerName || !customerEmail || !date) {
            return json(res, { error: 'Missing required fields' }, 400);
          }

          const style = STYLES[service];
          if (!style) {
            return json(res, { error: 'Invalid service selected' }, 400);
          }

          const siteUrl = env.VITE_SITE_URL || 'http://localhost:5173';

          const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            customer_email: customerEmail,
            line_items: [{
              price_data: {
                currency: 'usd',
                product_data: {
                  name: `Booking Deposit — ${style.label}`,
                  description: `$50 deposit to secure your ${style.label} appointment on ${date}`,
                },
                unit_amount: 5000, // $50.00
              },
              quantity: 1,
            }],
            metadata: {
              service,
              customerName,
              customerPhone: customerPhone || '',
              date,
            },
            success_url: `${siteUrl}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${siteUrl}/?payment=cancelled`,
          });

          console.log(`[SHB] Checkout session created: ${session.id} for ${style.label}`);
          json(res, { url: session.url });
        } catch (err) {
          console.error('[SHB API] Checkout error:', err.message);
          json(res, { error: err.message || 'Failed to create checkout session' }, 500);
        }
      });

      /* ─── POST /api/stripe-webhook ─── */
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname !== '/api/stripe-webhook' || req.method !== 'POST') return next();

        try {
          const stripe = getStripe(env);
          const rawBody = await getRawBody(req);
          const sig = req.headers['stripe-signature'];

          let event;
          if (env.STRIPE_WEBHOOK_SECRET && env.STRIPE_WEBHOOK_SECRET !== 'whsec_PLACEHOLDER') {
            event = stripe.webhooks.constructEvent(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);
          } else {
            // In dev without webhook secret, parse directly
            event = JSON.parse(rawBody.toString());
            console.warn('[SHB] Webhook signature verification skipped (no secret configured)');
          }

          if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            console.log('[SHB] Payment completed:', {
              sessionId: session.id,
              email: session.customer_email,
              amount: session.amount_total,
              service: session.metadata?.service,
              customerName: session.metadata?.customerName,
              date: session.metadata?.date,
            });
            // TODO: Insert into Supabase + trigger notification
          }

          json(res, { received: true });
        } catch (err) {
          console.error('[SHB API] Webhook error:', err.message);
          json(res, { error: 'Webhook handler failed' }, 400);
        }
      });

      const openai = env.OPENAI_API_KEY ? 'OpenAI' : null;
      const gemini = env.GEMINI_API_KEY ? 'Gemini' : null;
      const aiSources = [openai, gemini, 'Smart Fallback'].filter(Boolean).join(' → ');
      const stripeOk = env.STRIPE_SECRET_KEY && env.STRIPE_SECRET_KEY !== 'sk_test_PLACEHOLDER';

      console.log('\n  ✨ SweetHandBraids API Plugin loaded');
      console.log(`  AI chain: ${aiSources}`);
      console.log(`  Stripe:   ${stripeOk ? '✓ configured' : '✗ not configured'}`);
      console.log('  → POST /webhook/web-chat-intake      (AI Chat)');
      console.log('  → POST /webhook/create-video-room     (Daily.co)');
      console.log('  → POST /webhook/vapi-server-url       (VAPI)');
      console.log('  → POST /api/create-checkout-session   (Stripe)');
      console.log('  → POST /api/stripe-webhook            (Stripe)\n');
    },
  };
}
