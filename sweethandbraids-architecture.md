# SweetHandBraids.com — AI Stylist Platform
## N8N Workflow Architecture & Integration Specification

**Version:** 1.0  
**Date:** March 14, 2026  
**Author:** Czar (Eniola McCartney) / Claude Architecture Session  
**Status:** Production Design — Ready for Implementation

---

## 1. System Overview

SweetHandBraids is an AI-powered salon assistant platform that provides real-time hair braiding consultation, style recommendations, and appointment management through two synchronized channels: a website chat/video interface and a VAPI voice phone line. All interactions are orchestrated through N8N workflows with RAG-enhanced memory, ensuring the AI stylist agent continuously improves and maintains full context across every customer touchpoint.

### 1.1 Design Principles

- **Sub-workflow isolation**: Every discrete capability is its own N8N sub-workflow. Main workflows are thin routers only. This prevents cascading failures and enables independent testing/versioning.
- **Dual-channel sync**: Web and VAPI interactions write to the same memory layer. A customer who books via phone can reschedule via web chat with zero context loss.
- **RAG-first memory**: Every conversation turn is embedded and stored. On each new interaction, relevant history is retrieved and injected into the LLM context window — the agent literally gets smarter with every client interaction.
- **Graceful degradation**: If a sub-workflow fails, the parent catches the error and responds with a human-friendly fallback (e.g., "Let me connect you with our front desk") rather than a blank screen or dropped call.

---

## 2. Entry Points & Channels

### 2.1 Website Channel (sweethandbraids.com)

The website embeds a chat widget (recommended: **Voiceflow Web Chat** or custom React widget) with the following capabilities:

| Feature | Implementation |
|---------|---------------|
| Text chat | WebSocket connection to N8N webhook |
| Image upload | Pre-signed S3 upload → N8N webhook trigger |
| Video call | Daily.co / Twilio Video embedded iframe |
| Manual booking | Calendar UI component → N8N booking webhook |
| Style gallery | Static image grid with "I want this" CTA buttons |

**Website → N8N Connection Map:**

```
Chat message     → POST https://n8n.sweethandbraids.com/webhook/web-chat-intake
Image upload     → POST https://n8n.sweethandbraids.com/webhook/media-upload
Video frame      → POST https://n8n.sweethandbraids.com/webhook/media-upload
Manual booking   → POST https://n8n.sweethandbraids.com/webhook/booking-api
Style selection  → POST https://n8n.sweethandbraids.com/webhook/web-chat-intake (with style_id payload)
```

### 2.2 VAPI Voice Channel

A dedicated VAPI phone number routes all voice interactions through VAPI's server URL mechanism into N8N.

| Config | Value |
|--------|-------|
| VAPI Phone Number | Provisioned via VAPI dashboard |
| Server URL | `https://n8n.sweethandbraids.com/webhook/vapi-server-url` |
| Voice | `eleven_labs` — warm, friendly female voice |
| Model | `gpt-4o` or `claude-sonnet-4-20250514` via custom LLM |
| First message | "Hey love! Welcome to Sweet Hand Braids. I'm your AI stylist — how can I help you today?" |

**VAPI → N8N Event Flow:**

VAPI sends events to the Server URL webhook. N8N handles these event types:

```
assistant-request    → Return dynamic assistant config (system prompt, tools, voice)
function-call        → Execute tool calls (book_appointment, check_availability, etc.)
end-of-call-report   → Store full transcript + summary in memory
status-update        → Track call lifecycle (ringing, in-progress, ended)
hang                 → Graceful cleanup
transcript           → Real-time partial transcript storage
```

---

## 3. N8N Workflow Architecture

### 3.1 Workflow Inventory

| # | Workflow Name | Type | Trigger | Purpose |
|---|--------------|------|---------|---------|
| 1 | `main-web-chat` | Main | Webhook | Handle all website chat interactions |
| 2 | `main-vapi-handler` | Main | Webhook | Handle all VAPI voice events |
| 3 | `main-booking-api` | Main | Webhook | Handle manual booking requests |
| 4 | `main-media-processor` | Main | Webhook | Handle image/video uploads |
| 5 | `sub-customer-lookup` | Sub | Called | Find or create customer profile |
| 6 | `sub-memory-retrieval` | Sub | Called | RAG context fetch from vector DB |
| 7 | `sub-ai-stylist-agent` | Sub | Called | Core LLM reasoning + response |
| 8 | `sub-media-analysis` | Sub | Called | Vision API hair analysis |
| 9 | `sub-style-recommender` | Sub | Called | Vector similarity search for styles |
| 10 | `sub-appointment-manager` | Sub | Called | Book/cancel/reschedule logic |
| 11 | `sub-memory-writer` | Sub | Called | Embed + store interactions |
| 12 | `sub-notification-engine` | Sub | Called | SMS/email confirmations |
| 13 | `sub-error-handler` | Sub | Called | Centralized error handling + logging |

---

### 3.2 Main Workflow: `main-web-chat`

**Trigger:** Webhook node — `POST /webhook/web-chat-intake`

**Expected Payload:**
```json
{
  "session_id": "sess_abc123",
  "customer_id": "cust_456",       // null if anonymous
  "customer_phone": "+15551234567", // for identity resolution
  "customer_name": "Tasha",
  "message": "I want box braids, medium length, honey blonde",
  "message_type": "text",           // text | style_selection | video_frame
  "style_id": null,                 // populated if user clicked a style image
  "attachments": [],                // image URLs if uploaded
  "timestamp": "2026-03-14T15:30:00Z"
}
```

**Node Chain:**

```
1. Webhook (receive payload)
   ↓
2. IF node: Check message_type
   ├─ "text" or "style_selection" → continue
   └─ "video_frame" → Execute Sub-Workflow: sub-media-analysis → merge result
   ↓
3. Execute Sub-Workflow: sub-customer-lookup
   Input: { customer_phone, customer_name, customer_id }
   Output: { customer_profile, is_new_customer }
   ↓
4. Execute Sub-Workflow: sub-memory-retrieval
   Input: { customer_id, current_message, top_k: 10 }
   Output: { relevant_history[], last_appointment, preferences }
   ↓
5. Execute Sub-Workflow: sub-ai-stylist-agent
   Input: {
     customer_profile,
     relevant_history,
     current_message,
     style_id,
     media_analysis (if present),
     available_tools: ["recommend_styles", "book_appointment", "check_availability"]
   }
   Output: { response_text, tool_calls[], recommended_styles[] }
   ↓
6. IF node: Check tool_calls
   ├─ "book_appointment" → Execute Sub-Workflow: sub-appointment-manager
   ├─ "recommend_styles" → Execute Sub-Workflow: sub-style-recommender
   ├─ "check_availability" → Execute Sub-Workflow: sub-appointment-manager (availability mode)
   └─ none → continue
   ↓
7. Execute Sub-Workflow: sub-memory-writer
   Input: { customer_id, session_id, user_message, assistant_response, metadata }
   ↓
8. Respond to Webhook
   Output: {
     response: "Girl, box braids in honey blonde would look AMAZING on you! ...",
     images: ["https://cdn.sweethandbraids.com/styles/box-braids-honey-01.jpg"],
     booking_prompt: null | { available_slots: [...] },
     session_id: "sess_abc123"
   }
```

**Error Handling:** Wrap nodes 3-7 in a Try/Catch. On failure → Execute `sub-error-handler` → Return friendly fallback response to webhook.

---

### 3.3 Main Workflow: `main-vapi-handler`

**Trigger:** Webhook node — `POST /webhook/vapi-server-url`

**VAPI Server URL Protocol:**

VAPI sends a JSON body with a `message` object. The `message.type` field determines routing.

**Node Chain:**

```
1. Webhook (receive VAPI event)
   ↓
2. Switch node: Route on message.type
   │
   ├─ "assistant-request" →
   │   ├─ Extract caller phone from message.call.customer.number
   │   ├─ Execute Sub-Workflow: sub-customer-lookup
   │   ├─ Execute Sub-Workflow: sub-memory-retrieval (last 5 interactions)
   │   ├─ Build dynamic system prompt with customer context
   │   └─ Respond with assistant config:
   │       {
   │         "assistant": {
   │           "firstMessage": "Hey Tasha! Welcome back to Sweet Hand Braids...",
   │           "model": {
   │             "provider": "openai",
   │             "model": "gpt-4o",
   │             "systemMessage": "<dynamic_prompt_with_rag_context>",
   │             "tools": [
   │               { "type": "function", "function": { "name": "book_appointment", ... } },
   │               { "type": "function", "function": { "name": "check_availability", ... } },
   │               { "type": "function", "function": { "name": "cancel_appointment", ... } },
   │               { "type": "function", "function": { "name": "reschedule_appointment", ... } },
   │               { "type": "function", "function": { "name": "recommend_style", ... } }
   │             ]
   │           },
   │           "voice": {
   │             "provider": "11labs",
   │             "voiceId": "<warm_friendly_voice_id>"
   │           }
   │         }
   │       }
   │
   ├─ "function-call" →
   │   ├─ Switch on function_name:
   │   │   ├─ "book_appointment" → Execute Sub-Workflow: sub-appointment-manager
   │   │   ├─ "check_availability" → Execute Sub-Workflow: sub-appointment-manager
   │   │   ├─ "cancel_appointment" → Execute Sub-Workflow: sub-appointment-manager
   │   │   ├─ "reschedule_appointment" → Execute Sub-Workflow: sub-appointment-manager
   │   │   └─ "recommend_style" → Execute Sub-Workflow: sub-style-recommender
   │   └─ Respond with function result:
   │       { "result": "<stringified_result>" }
   │
   ├─ "end-of-call-report" →
   │   ├─ Extract: transcript, summary, duration, call_id
   │   ├─ Execute Sub-Workflow: sub-customer-lookup (by phone)
   │   ├─ Execute Sub-Workflow: sub-memory-writer
   │   │   Input: { customer_id, channel: "voice", full_transcript, summary, call_metadata }
   │   └─ Execute Sub-Workflow: sub-notification-engine (if appointment booked during call)
   │
   ├─ "status-update" →
   │   └─ Log to monitoring (Supabase events table)
   │
   └─ "hang" →
       └─ Respond 200 OK (no action needed)
```

---

### 3.4 Main Workflow: `main-booking-api`

**Trigger:** Webhook node — `POST /webhook/booking-api`

**Expected Payload:**
```json
{
  "action": "book" | "cancel" | "reschedule" | "check_availability",
  "customer_id": "cust_456",
  "customer_phone": "+15551234567",
  "customer_name": "Tasha Williams",
  "service_type": "box_braids",
  "preferred_date": "2026-03-20",
  "preferred_time": "10:00",
  "duration_minutes": 180,
  "stylist_preference": "any" | "stylist_name",
  "notes": "Honey blonde, medium length",
  "existing_appointment_id": null  // for cancel/reschedule
}
```

**Node Chain:**
```
1. Webhook
   ↓
2. Execute Sub-Workflow: sub-customer-lookup
   ↓
3. Execute Sub-Workflow: sub-appointment-manager
   Input: { action, customer_profile, booking_details }
   Output: { success, appointment_id, confirmation_details }
   ↓
4. Execute Sub-Workflow: sub-memory-writer
   Input: { customer_id, event: "appointment_action", details }
   ↓
5. Execute Sub-Workflow: sub-notification-engine
   Input: { customer_phone, action, confirmation_details }
   ↓
6. Respond to Webhook
```

---

### 3.5 Main Workflow: `main-media-processor`

**Trigger:** Webhook node — `POST /webhook/media-upload`

**Expected Payload:**
```json
{
  "session_id": "sess_abc123",
  "customer_id": "cust_456",
  "media_type": "image" | "video_frame",
  "media_url": "https://s3.amazonaws.com/sweethandbraids/uploads/img_xyz.jpg",
  "context": "Customer wants style recommendation based on this image"
}
```

**Node Chain:**
```
1. Webhook
   ↓
2. HTTP Request: Download media from URL
   ↓
3. Execute Sub-Workflow: sub-media-analysis
   Input: { media_base64, media_type, context }
   Output: {
     hair_profile: {
       current_length: "shoulder_length",
       thickness: "thick",
       texture: "4c",
       current_color: "natural_black",
       scalp_condition: "healthy",
       face_shape: "oval"
     },
     detected_style: "twist_out",
     recommendation_context: "Customer has thick 4c hair at shoulder length..."
   }
   ↓
4. Execute Sub-Workflow: sub-style-recommender
   Input: { hair_profile, customer_preferences }
   Output: { recommended_styles[] with images }
   ↓
5. Execute Sub-Workflow: sub-memory-writer
   Input: { customer_id, hair_profile, media_url }
   ↓
6. Respond to Webhook
   Output: { hair_profile, recommended_styles }
```

---

## 4. Sub-Workflow Specifications

### 4.1 `sub-customer-lookup`

**Purpose:** Unified identity resolution across all channels. Phone number is the primary key for cross-channel sync.

**Input:**
```json
{
  "customer_phone": "+15551234567",
  "customer_name": "Tasha",
  "customer_id": null,
  "channel": "web" | "voice"
}
```

**Node Chain:**
```
1. Supabase Node: SELECT from customers WHERE phone = customer_phone
   ↓
2. IF node: Customer exists?
   ├─ YES → Merge with incoming data, update last_seen timestamp
   │   └─ Supabase Node: UPDATE customers SET last_seen = NOW()
   └─ NO → Create new customer
       └─ Supabase Node: INSERT into customers
           { phone, name, channel_first_contact, created_at }
   ↓
3. Supabase Node: SELECT last 3 appointments for customer
   ↓
4. Return: { customer_profile, recent_appointments, is_new_customer }
```

**Supabase `customers` Table Schema:**
```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255),
  email VARCHAR(255),
  hair_profile JSONB DEFAULT '{}',
  preferences JSONB DEFAULT '{}',
  lifetime_visits INT DEFAULT 0,
  lifetime_spend DECIMAL(10,2) DEFAULT 0,
  channel_first_contact VARCHAR(20),
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 4.2 `sub-memory-retrieval` (RAG Engine — Read Path)

**Purpose:** Retrieve relevant conversation history and customer context for the current interaction using vector similarity search.

**Input:**
```json
{
  "customer_id": "cust_456",
  "current_message": "I want something different this time, maybe goddess locs",
  "top_k": 10,
  "include_global_knowledge": true
}
```

**Node Chain:**
```
1. OpenAI Node: Generate embedding for current_message
   Model: text-embedding-3-small
   Output: embedding_vector (1536 dimensions)
   ↓
2. HTTP Request: Pinecone query
   POST https://<index>.pinecone.io/query
   Body: {
     "vector": embedding_vector,
     "topK": 10,
     "filter": { "customer_id": { "$eq": "cust_456" } },
     "includeMetadata": true
   }
   Output: matched_memories[]
   ↓
3. IF node: include_global_knowledge?
   ├─ YES → HTTP Request: Pinecone query (namespace: "style_knowledge")
   │   Filter: style-related content without customer filter
   │   → Merge with customer memories
   └─ NO → continue
   ↓
4. Code Node: Format RAG context
   - Sort by relevance score
   - Deduplicate near-identical entries
   - Format as structured context block:
     """
     [CUSTOMER HISTORY]
     - Last visit: March 1 — got knotless box braids, loved them
     - Preference: prefers protective styles
     - Hair: 4c, thick, shoulder length
     - Note: Allergic to certain edge control brands

     [STYLE KNOWLEDGE]
     - Goddess locs: 4-6 hours install, lasts 6-8 weeks
     - Best for: medium to long hair, all textures
     """
   ↓
5. Return: { rag_context, relevant_history[], last_appointment, hair_profile }
```

---

### 4.3 `sub-ai-stylist-agent` (Core Intelligence)

**Purpose:** The brain of the system. Receives full context and generates stylist-quality responses with tool-calling capability.

**Input:**
```json
{
  "customer_profile": { ... },
  "rag_context": "formatted context string",
  "current_message": "I want goddess locs",
  "media_analysis": null | { hair_profile },
  "available_tools": ["recommend_styles", "book_appointment", "check_availability"],
  "channel": "web" | "voice"
}
```

**System Prompt (injected dynamically):**
```
You are SweetHand, the AI hair braiding stylist at Sweet Hand Braids salon.

PERSONALITY:
- Warm, confident, knowledgeable — like a best friend who happens to be an expert braider
- Use natural, friendly language. "Girl," "love," "honey" are part of your vocabulary
- Be genuinely enthusiastic about hair — you LOVE what you do
- Give honest advice — if a style won't work for their hair type, say so kindly and suggest alternatives

EXPERTISE:
- You are an expert in ALL braiding styles: box braids, knotless, goddess locs, passion twists,
  cornrows, fulani braids, butterfly locs, faux locs, crochet braids, feed-in braids, tribal braids,
  and more
- You can assess hair health, texture (2a-4c), porosity, density, and length from descriptions
  or images
- You know realistic timeframes, pricing ranges, maintenance requirements, and longevity for
  every style
- You understand how hair grade, color, and length affect style suitability

CUSTOMER CONTEXT (from memory):
{rag_context}

CURRENT CUSTOMER:
Name: {customer_profile.name}
Hair Profile: {customer_profile.hair_profile}
Visit History: {customer_profile.lifetime_visits} visits

RULES:
1. Always ask about hair allergies before recommending products
2. If the customer mentions a style, confirm the specific variation they want (e.g., "large box braids or medium?")
3. When recommending styles, always mention: estimated time, price range, maintenance tips
4. If they want to book, use the book_appointment tool — never just say "call us"
5. If you're uncertain about their hair, ask for a photo or suggest a consultation visit
6. For voice calls: keep responses concise (2-3 sentences max). For web chat: you can be more detailed
7. Always end with a clear next step — recommendation, booking prompt, or follow-up question
```

**Node Chain:**
```
1. Code Node: Assemble full prompt
   - Inject rag_context into system prompt
   - Build messages array: [system, ...history, user_message]
   - Attach tool definitions based on available_tools
   ↓
2. OpenAI/Anthropic Node: Chat completion
   Model: gpt-4o or claude-sonnet-4-20250514
   Tools: [recommend_styles, book_appointment, check_availability,
           cancel_appointment, reschedule_appointment]
   ↓
3. IF node: Response contains tool_calls?
   ├─ YES → Return tool_calls for parent workflow to execute
   └─ NO → Continue
   ↓
4. Code Node: Format response
   - For voice channel: strip markdown, shorten to 2-3 sentences
   - For web channel: include rich formatting, style image placeholders
   ↓
5. Return: { response_text, tool_calls[], channel_formatted: true }
```

**Tool Definitions for LLM:**

```json
[
  {
    "name": "book_appointment",
    "description": "Book a hair braiding appointment for the customer",
    "parameters": {
      "service_type": "string — e.g., box_braids, goddess_locs, cornrows",
      "preferred_date": "string — YYYY-MM-DD",
      "preferred_time": "string — HH:MM",
      "duration_minutes": "integer — estimated service duration",
      "notes": "string — style details, color, length preferences"
    }
  },
  {
    "name": "check_availability",
    "description": "Check available appointment slots for a given date range",
    "parameters": {
      "start_date": "string — YYYY-MM-DD",
      "end_date": "string — YYYY-MM-DD",
      "service_duration_minutes": "integer"
    }
  },
  {
    "name": "recommend_styles",
    "description": "Search the style catalog for braiding styles matching criteria",
    "parameters": {
      "hair_texture": "string — e.g., 4c, 3b, 2a",
      "desired_length": "string — short, medium, long, extra_long",
      "style_category": "string — protective, casual, formal, trendy",
      "max_results": "integer — default 3"
    }
  },
  {
    "name": "cancel_appointment",
    "description": "Cancel an existing appointment",
    "parameters": {
      "appointment_id": "string",
      "reason": "string"
    }
  },
  {
    "name": "reschedule_appointment",
    "description": "Reschedule an existing appointment to a new date/time",
    "parameters": {
      "appointment_id": "string",
      "new_date": "string — YYYY-MM-DD",
      "new_time": "string — HH:MM"
    }
  }
]
```

---

### 4.4 `sub-media-analysis` (Vision Pipeline)

**Purpose:** Analyze uploaded photos or video frames to extract hair characteristics.

**Input:**
```json
{
  "media_base64": "<base64_encoded_image>",
  "media_type": "image/jpeg",
  "context": "Customer wants style recommendation"
}
```

**Node Chain:**
```
1. OpenAI Node: Vision API call
   Model: gpt-4o (vision)
   Messages: [
     {
       "role": "system",
       "content": "You are a professional hair analysis expert. Analyze the image and extract..."
     },
     {
       "role": "user",
       "content": [
         { "type": "image_url", "image_url": { "url": "data:image/jpeg;base64,..." } },
         { "type": "text", "text": "Analyze this customer's hair and provide a structured assessment." }
       ]
     }
   ]
   ↓
2. Code Node: Parse + validate LLM output
   Expected structure:
   {
     "hair_profile": {
       "texture": "4c",
       "length": "shoulder_length",
       "thickness": "thick",
       "current_color": "natural_black",
       "condition": "healthy",
       "porosity_estimate": "low",
       "face_shape": "oval",
       "current_style": "twist_out"
     },
     "observations": "Hair appears healthy with good curl definition...",
     "style_suitability": ["box_braids", "goddess_locs", "passion_twists", "cornrows"],
     "cautions": ["May need deep conditioning before protective style installation"]
   }
   ↓
3. Return: { hair_profile, observations, style_suitability, cautions }
```

---

### 4.5 `sub-style-recommender` (Vector Search + Image Retrieval)

**Purpose:** Find matching braiding styles from the catalog using semantic vector search and return real reference images.

**Input:**
```json
{
  "query": "goddess locs honey blonde medium length",
  "hair_profile": { "texture": "4c", "length": "shoulder_length" },
  "max_results": 4
}
```

**Node Chain:**
```
1. OpenAI Node: Generate embedding for query
   ↓
2. HTTP Request: Pinecone query (namespace: "style_catalog")
   Body: {
     "vector": query_embedding,
     "topK": max_results,
     "filter": {
       "compatible_textures": { "$in": ["4c", "all"] }
     },
     "includeMetadata": true
   }
   ↓
3. Code Node: Format style cards
   For each matched style:
   {
     "style_id": "style_089",
     "name": "Goddess Locs — Honey Blonde",
     "image_urls": [
       "https://cdn.sweethandbraids.com/styles/goddess-locs-honey-01.jpg",
       "https://cdn.sweethandbraids.com/styles/goddess-locs-honey-02.jpg"
     ],
     "estimated_time": "5-7 hours",
     "price_range": "$180 - $280",
     "maintenance": "Lasts 8-12 weeks with proper care",
     "compatibility_score": 0.94,
     "description": "Soft, flowing goddess locs with honey blonde highlights..."
   }
   ↓
4. Return: { recommended_styles[], total_matches }
```

**Pinecone `style_catalog` Namespace Schema:**

Each vector represents a style variant with metadata:
```json
{
  "id": "style_089",
  "values": [0.023, -0.891, ...],  // embedding of style description
  "metadata": {
    "name": "Goddess Locs — Honey Blonde",
    "category": "locs",
    "sub_category": "goddess_locs",
    "compatible_textures": ["3c", "4a", "4b", "4c", "all"],
    "min_length": "chin_length",
    "install_time_hours_min": 5,
    "install_time_hours_max": 7,
    "price_min": 180,
    "price_max": 280,
    "longevity_weeks": 10,
    "image_urls": ["https://cdn.sweethandbraids.com/styles/..."],
    "tags": ["protective", "trendy", "low_maintenance"],
    "popularity_score": 87
  }
}
```

---

### 4.6 `sub-appointment-manager`

**Purpose:** Unified appointment CRUD with Google Calendar integration and conflict detection.

**Input:**
```json
{
  "action": "book" | "cancel" | "reschedule" | "check_availability",
  "customer_profile": { ... },
  "booking_details": {
    "service_type": "goddess_locs",
    "preferred_date": "2026-03-20",
    "preferred_time": "10:00",
    "duration_minutes": 360,
    "stylist_preference": "any",
    "notes": "Honey blonde, medium length"
  },
  "existing_appointment_id": null
}
```

**Node Chain (Book action):**
```
1. Switch node: Route on action
   ↓ (book)
2. Google Calendar Node: List events for preferred_date
   Calendar: sweethandbraids-bookings@gmail.com
   TimeMin: preferred_date T00:00
   TimeMax: preferred_date T23:59
   ↓
3. Code Node: Find available slots
   - Map existing events to occupied time blocks
   - Check if preferred_time + duration fits
   - If conflict: find nearest available slot
   ↓
4. IF node: Slot available?
   ├─ YES →
   │   ├─ Google Calendar Node: Create event
   │   │   Title: "[Customer Name] — Goddess Locs"
   │   │   Start: 2026-03-20T10:00:00
   │   │   End: 2026-03-20T16:00:00
   │   │   Description: Notes + customer phone + style details
   │   ├─ Supabase Node: INSERT into appointments
   │   │   { customer_id, service_type, start_time, end_time, status: "confirmed",
   │   │     google_event_id, notes }
   │   └─ Return: { success: true, appointment }
   └─ NO →
       └─ Return: { success: false, alternative_slots: [...] }
```

**Node Chain (Check Availability):**
```
1. Google Calendar Node: List events for date range
   ↓
2. Code Node: Build availability matrix
   - 30-minute slot resolution
   - Operating hours: 9:00 AM — 7:00 PM
   - Filter slots that can fit requested duration
   ↓
3. Return: { available_slots: [{ date, time, stylist }] }
```

**Supabase `appointments` Table:**
```sql
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  service_type VARCHAR(100) NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL,
  stylist_name VARCHAR(255),
  status VARCHAR(20) DEFAULT 'confirmed',  -- confirmed, cancelled, completed, no_show
  google_event_id VARCHAR(255),
  notes TEXT,
  price_quoted DECIMAL(10,2),
  channel_booked VARCHAR(20),  -- web, voice, manual
  cancelled_reason TEXT,
  rescheduled_from UUID REFERENCES appointments(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_appointments_customer ON appointments(customer_id);
CREATE INDEX idx_appointments_start ON appointments(start_time);
CREATE INDEX idx_appointments_status ON appointments(status);
```

---

### 4.7 `sub-memory-writer` (RAG Engine — Write Path)

**Purpose:** Embed and store every interaction for future RAG retrieval. This is what makes the agent smarter over time.

**Input:**
```json
{
  "customer_id": "cust_456",
  "session_id": "sess_abc123",
  "channel": "web" | "voice",
  "interaction_type": "chat" | "appointment" | "style_recommendation" | "call_transcript",
  "user_message": "I want goddess locs in honey blonde",
  "assistant_response": "Girl, goddess locs would look amazing on you!...",
  "metadata": {
    "style_discussed": "goddess_locs",
    "appointment_booked": false,
    "hair_profile_updated": false
  }
}
```

**Node Chain:**
```
1. Code Node: Build embedding text
   Combine: user_message + assistant_response + metadata summary
   → "Customer requested goddess locs in honey blonde. AI recommended goddess locs,
      discussed pricing ($180-$280), estimated 5-7 hours. No appointment booked yet."
   ↓
2. OpenAI Node: Generate embedding
   Model: text-embedding-3-small
   Input: combined_text
   Output: embedding_vector
   ↓
3. HTTP Request: Pinecone upsert (namespace: "conversations")
   POST https://<index>.pinecone.io/vectors/upsert
   Body: {
     "vectors": [{
       "id": "mem_{customer_id}_{timestamp}",
       "values": embedding_vector,
       "metadata": {
         "customer_id": "cust_456",
         "session_id": "sess_abc123",
         "channel": "web",
         "interaction_type": "chat",
         "summary": "Discussed goddess locs in honey blonde",
         "styles_mentioned": ["goddess_locs"],
         "appointment_action": null,
         "timestamp": "2026-03-14T15:30:00Z"
       }
     }]
   }
   ↓
4. Supabase Node: INSERT into interaction_log
   { customer_id, session_id, channel, user_message, assistant_response,
     embedding_id, metadata, created_at }
   ↓
5. IF node: Hair profile data extracted?
   ├─ YES → Supabase Node: UPDATE customers SET hair_profile = merged_profile
   └─ NO → skip
   ↓
6. Return: { stored: true, embedding_id }
```

**Supabase `interaction_log` Table:**
```sql
CREATE TABLE interaction_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  session_id VARCHAR(100),
  channel VARCHAR(20) NOT NULL,
  interaction_type VARCHAR(50),
  user_message TEXT,
  assistant_response TEXT,
  embedding_id VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_interactions_customer ON interaction_log(customer_id);
CREATE INDEX idx_interactions_session ON interaction_log(session_id);
CREATE INDEX idx_interactions_created ON interaction_log(created_at);
```

---

### 4.8 `sub-notification-engine`

**Purpose:** Send appointment confirmations, reminders, and updates via SMS and email.

**Input:**
```json
{
  "customer_phone": "+15551234567",
  "customer_email": "tasha@example.com",
  "notification_type": "booking_confirmation" | "reminder_24h" | "cancellation" | "reschedule",
  "appointment_details": { ... }
}
```

**Node Chain:**
```
1. Switch node: Route on notification_type
   ↓
2. Code Node: Build message template
   ↓
3. Twilio Node: Send SMS
   Body: "Hey Tasha! Your goddess locs appointment is confirmed for
          March 20 at 10:00 AM. See you at Sweet Hand Braids!
          Reply CANCEL to cancel or RESCHEDULE to change the date."
   ↓
4. (Optional) Email Node: Send confirmation email with style reference images
   ↓
5. Return: { sms_sent: true, email_sent: true }
```

**Reminder Cron Workflow (separate):**
A separate N8N workflow triggered by Cron node runs daily at 9:00 AM:
```
1. Cron Node: Daily at 9:00 AM
   ↓
2. Supabase Node: SELECT appointments WHERE start_time BETWEEN NOW()+23h AND NOW()+25h
   AND status = 'confirmed'
   ↓
3. Loop Node: For each upcoming appointment
   ↓
4. Execute Sub-Workflow: sub-notification-engine
   notification_type: "reminder_24h"
```

---

### 4.9 `sub-error-handler`

**Purpose:** Centralized error logging, alerting, and graceful fallback generation.

**Input:**
```json
{
  "workflow_name": "main-web-chat",
  "node_name": "sub-ai-stylist-agent",
  "error_message": "OpenAI API rate limit exceeded",
  "customer_id": "cust_456",
  "channel": "web"
}
```

**Node Chain:**
```
1. Supabase Node: INSERT into error_log
   { workflow_name, node_name, error_message, customer_id, timestamp }
   ↓
2. IF node: Is this a critical error? (booking failure, data loss risk)
   ├─ YES → Twilio Node: Send SMS alert to salon owner
   └─ NO → Continue
   ↓
3. Code Node: Generate fallback response
   - Web: "I'm having a little trouble right now, love. Let me connect you with our team — you can reach us directly at (XXX) XXX-XXXX or text us!"
   - Voice: "I'm so sorry honey, I'm having a small technical hiccup. Let me transfer you to our front desk."
   ↓
4. Return: { fallback_response, error_logged: true }
```

---

## 5. Data Architecture

### 5.1 Supabase PostgreSQL Tables

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `customers` | Customer profiles | phone (unique), name, hair_profile, preferences |
| `appointments` | All bookings | customer_id, service_type, start/end_time, status, google_event_id |
| `interaction_log` | Full conversation history | customer_id, channel, messages, embedding_id |
| `style_catalog` | Braiding styles master list | name, category, images, pricing, compatibility |
| `error_log` | System errors | workflow, node, error, timestamp |
| `analytics_events` | Usage tracking | event_type, customer_id, channel, metadata |

### 5.2 Pinecone Vector DB Namespaces

| Namespace | Purpose | Dimension | Metadata |
|-----------|---------|-----------|----------|
| `conversations` | Customer interaction history | 1536 | customer_id, channel, timestamp, summary |
| `style_catalog` | Style embeddings for similarity search | 1536 | name, category, textures, pricing, images |
| `style_knowledge` | General braiding knowledge base | 1536 | topic, source, category |

### 5.3 External Storage

| Service | Purpose |
|---------|---------|
| S3 / Cloudinary | Style reference images, customer uploads, video frames |
| Redis | Active session cache (session_id → current context), rate limiting |
| Google Calendar | Appointment slots, availability |

---

## 6. RAG Knowledge Base Seeding

Before go-live, seed the Pinecone `style_knowledge` namespace with braiding domain knowledge:

### 6.1 Content Sources to Embed

1. **Style encyclopedia** — 50-100 braiding style descriptions with characteristics, care instructions, pricing guidelines, compatibility notes
2. **Consultation scripts** — Common customer Q&A patterns, objection handling, upsell paths
3. **Hair science basics** — Texture classification (Andre Walker system), porosity testing, protein-moisture balance
4. **Product knowledge** — Safe brands, allergen warnings, edge control recommendations
5. **Salon-specific info** — Hours, location, pricing menu, stylist bios, cancellation policy

### 6.2 Seeding Workflow (one-time `seed-rag-knowledge`)

```
1. Read File Node: Load knowledge documents (JSON/CSV)
   ↓
2. Loop Node: For each knowledge chunk
   ↓
3. OpenAI Node: Generate embedding
   ↓
4. HTTP Request: Pinecone upsert to style_knowledge namespace
   ↓
5. Log completion
```

---

## 7. Website Integration Code

### 7.1 Chat Widget Embed (React Component)

```jsx
// SweetHandChat.jsx — embed in sweethandbraids.com
const N8N_WEBHOOK = "https://n8n.sweethandbraids.com/webhook/web-chat-intake";
const MEDIA_WEBHOOK = "https://n8n.sweethandbraids.com/webhook/media-upload";

async function sendMessage(sessionId, customerId, message, attachments = []) {
  const response = await fetch(N8N_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: sessionId,
      customer_id: customerId,
      message: message,
      message_type: attachments.length > 0 ? "image" : "text",
      attachments: attachments,
      timestamp: new Date().toISOString()
    })
  });
  return response.json();
  // Returns: { response, images[], booking_prompt }
}

async function uploadMedia(sessionId, customerId, file) {
  // 1. Upload to S3 via pre-signed URL (separate endpoint)
  // 2. Send media URL to N8N
  const mediaUrl = await uploadToS3(file);
  const response = await fetch(MEDIA_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: sessionId,
      customer_id: customerId,
      media_type: "image",
      media_url: mediaUrl
    })
  });
  return response.json();
  // Returns: { hair_profile, recommended_styles[] }
}
```

### 7.2 Booking Widget Integration

```jsx
async function bookAppointment(customerId, serviceType, date, time, notes) {
  const response = await fetch(
    "https://n8n.sweethandbraids.com/webhook/booking-api",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "book",
        customer_id: customerId,
        service_type: serviceType,
        preferred_date: date,
        preferred_time: time,
        duration_minutes: SERVICE_DURATIONS[serviceType],
        notes: notes
      })
    }
  );
  return response.json();
  // Returns: { success, appointment_id, confirmation_details }
}
```

---

## 8. VAPI Configuration

### 8.1 VAPI Assistant Setup

```json
{
  "name": "SweetHand AI Stylist",
  "model": {
    "provider": "openai",
    "model": "gpt-4o",
    "temperature": 0.7,
    "maxTokens": 300
  },
  "voice": {
    "provider": "11labs",
    "voiceId": "<select_warm_friendly_voice>",
    "stability": 0.6,
    "similarityBoost": 0.8
  },
  "serverUrl": "https://n8n.sweethandbraids.com/webhook/vapi-server-url",
  "serverUrlSecret": "<shared_secret_for_webhook_verification>",
  "firstMessage": "Hey love! Welcome to Sweet Hand Braids — I'm your AI stylist. Whether you're looking for a new look or need to book an appointment, I've got you. What can I help you with today?",
  "endCallMessage": "It was so great chatting with you! We can't wait to see you at the salon. Bye love!",
  "transcriber": {
    "provider": "deepgram",
    "model": "nova-2",
    "language": "en"
  },
  "endCallFunctionEnabled": true,
  "recordingEnabled": true,
  "silenceTimeoutSeconds": 30,
  "maxDurationSeconds": 600
}
```

### 8.2 VAPI Function Definitions (registered in VAPI dashboard)

These functions are called by VAPI and routed to N8N via the Server URL:

```json
[
  {
    "name": "book_appointment",
    "description": "Book a hair braiding appointment",
    "parameters": {
      "type": "object",
      "properties": {
        "service_type": { "type": "string", "description": "Type of braiding service" },
        "preferred_date": { "type": "string", "description": "Preferred date (YYYY-MM-DD)" },
        "preferred_time": { "type": "string", "description": "Preferred time (HH:MM)" },
        "notes": { "type": "string", "description": "Style details and preferences" }
      },
      "required": ["service_type", "preferred_date", "preferred_time"]
    }
  },
  {
    "name": "check_availability",
    "description": "Check available appointment slots",
    "parameters": {
      "type": "object",
      "properties": {
        "start_date": { "type": "string" },
        "end_date": { "type": "string" },
        "service_duration_minutes": { "type": "integer" }
      },
      "required": ["start_date"]
    }
  },
  {
    "name": "cancel_appointment",
    "description": "Cancel an existing appointment",
    "parameters": {
      "type": "object",
      "properties": {
        "reason": { "type": "string" }
      }
    }
  },
  {
    "name": "reschedule_appointment",
    "description": "Reschedule to a new date and time",
    "parameters": {
      "type": "object",
      "properties": {
        "new_date": { "type": "string" },
        "new_time": { "type": "string" }
      },
      "required": ["new_date", "new_time"]
    }
  }
]
```

---

## 9. Production Checklist

### 9.1 Security

- [ ] Webhook authentication: Add `X-Webhook-Secret` header validation on all N8N webhooks
- [ ] VAPI server URL secret: Verify `x-vapi-secret` header on incoming VAPI requests
- [ ] Rate limiting: Redis-based rate limiter on web chat webhook (max 30 msg/min per session)
- [ ] Input sanitization: Validate all incoming payloads before processing
- [ ] S3 uploads: Pre-signed URLs with 5-minute expiry, max 10MB file size
- [ ] Supabase RLS: Row-level security on all customer data tables

### 9.2 Monitoring & Observability

- [ ] N8N execution logs: Enable detailed logging on all workflows
- [ ] Error alerting: SMS to salon owner on critical failures
- [ ] Usage dashboards: Track daily conversations, bookings, style recommendations
- [ ] Latency monitoring: Web chat response should be under 3 seconds
- [ ] VAPI call quality: Monitor transcription accuracy and call completion rates

### 9.3 Testing

- [ ] End-to-end test: Web chat → booking → confirmation SMS
- [ ] End-to-end test: VAPI call → booking → memory recall on next call
- [ ] Cross-channel test: Book via phone → reschedule via web chat
- [ ] RAG accuracy test: Verify relevant history is retrieved
- [ ] Failure test: Kill OpenAI connection → verify graceful fallback
- [ ] Load test: Simulate 20 concurrent chat sessions

### 9.4 Go-Live Sequence

1. Deploy Supabase schema + seed style catalog
2. Seed Pinecone with style knowledge + salon info
3. Deploy N8N sub-workflows (bottom-up: error handler → memory → customer → stylist → mains)
4. Configure VAPI assistant + phone number
5. Embed chat widget on staging site
6. Run full test suite
7. Deploy to production
8. Monitor first 48 hours closely

---

## 10. Cost Estimates (Monthly at Scale)

| Service | Usage Estimate | Monthly Cost |
|---------|---------------|-------------|
| N8N Cloud (Pro) | ~10K executions/mo | $50 |
| Supabase (Pro) | 8GB database | $25 |
| Pinecone (Starter) | 100K vectors | $0 (free tier) |
| OpenAI (GPT-4o) | ~500K tokens/mo | $15 |
| OpenAI (Embeddings) | ~2M tokens/mo | $2 |
| VAPI | ~200 calls/mo × 5 min avg | $100 |
| Twilio (SMS) | ~500 messages/mo | $10 |
| Cloudinary (Free) | Image CDN | $0 |
| Google Calendar API | Free tier | $0 |
| **Total** | | **~$200/mo** |

---

*This architecture is designed to scale from launch (50 customers/month) to growth (500+ customers/month) without structural changes. The sub-workflow pattern means individual components can be upgraded, replaced, or scaled independently.*
