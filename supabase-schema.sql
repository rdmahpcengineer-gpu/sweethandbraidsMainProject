-- ============================================================
-- SweetHandBraids.com — Supabase Database Schema
-- AI Stylist Platform — Full Production Schema
-- ============================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- CUSTOMERS TABLE
-- Primary identity store. Phone number is the cross-channel key.
-- ============================================================
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255),
  email VARCHAR(255),
  
  -- Hair profile (updated by vision analysis + conversations)
  hair_profile JSONB DEFAULT '{}'::jsonb,
  -- Example: { "texture": "4c", "length": "shoulder", "thickness": "thick",
  --            "color": "natural_black", "porosity": "low", "condition": "healthy" }
  
  -- Style preferences (accumulated from interactions)
  preferences JSONB DEFAULT '{}'::jsonb,
  -- Example: { "favorite_styles": ["box_braids", "goddess_locs"],
  --            "allergies": ["brand_x_edge_control"],
  --            "preferred_length": "medium", "color_preference": "honey_blonde" }
  
  -- Engagement metrics
  lifetime_visits INT DEFAULT 0,
  lifetime_spend DECIMAL(10,2) DEFAULT 0.00,
  no_show_count INT DEFAULT 0,
  
  -- Channel tracking
  channel_first_contact VARCHAR(20), -- 'web' or 'voice'
  last_channel VARCHAR(20),
  
  -- Timestamps
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_email ON customers(email) WHERE email IS NOT NULL;
CREATE INDEX idx_customers_last_seen ON customers(last_seen);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_customers_updated
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- APPOINTMENTS TABLE
-- All bookings across all channels. Synced with Google Calendar.
-- ============================================================
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Service details
  service_type VARCHAR(100) NOT NULL,
  service_description TEXT,
  
  -- Scheduling
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL,
  
  -- Stylist assignment
  stylist_name VARCHAR(255),
  
  -- Status tracking
  status VARCHAR(20) DEFAULT 'confirmed'
    CHECK (status IN ('confirmed', 'cancelled', 'completed', 'no_show', 'rescheduled')),
  
  -- External sync
  google_event_id VARCHAR(255),
  
  -- Details
  notes TEXT,
  price_quoted DECIMAL(10,2),
  price_final DECIMAL(10,2),
  
  -- Channel + audit
  channel_booked VARCHAR(20) NOT NULL, -- 'web', 'voice', 'manual'
  booked_by VARCHAR(50) DEFAULT 'ai_stylist', -- 'ai_stylist', 'customer', 'staff'
  
  -- Cancellation/rescheduling
  cancelled_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  rescheduled_from UUID REFERENCES appointments(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_appointments_customer ON appointments(customer_id);
CREATE INDEX idx_appointments_start ON appointments(start_time);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_google ON appointments(google_event_id) WHERE google_event_id IS NOT NULL;

CREATE TRIGGER trg_appointments_updated
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- INTERACTION LOG TABLE
-- Full conversation history for both channels.
-- Links to Pinecone embedding IDs for RAG retrieval.
-- ============================================================
CREATE TABLE interaction_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  session_id VARCHAR(100),
  
  -- Interaction metadata
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('web', 'voice')),
  interaction_type VARCHAR(50) NOT NULL
    CHECK (interaction_type IN ('chat', 'call_transcript', 'appointment_action',
                                 'style_recommendation', 'media_analysis', 'system')),
  
  -- Content
  user_message TEXT,
  assistant_response TEXT,
  
  -- RAG reference
  embedding_id VARCHAR(255), -- Pinecone vector ID
  
  -- Structured metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  -- Example: { "styles_discussed": ["goddess_locs"], "appointment_booked": true,
  --            "hair_profile_updated": true, "call_duration_seconds": 180 }
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_interactions_customer ON interaction_log(customer_id);
CREATE INDEX idx_interactions_session ON interaction_log(session_id);
CREATE INDEX idx_interactions_created ON interaction_log(created_at);
CREATE INDEX idx_interactions_type ON interaction_log(interaction_type);
CREATE INDEX idx_interactions_channel ON interaction_log(channel);

-- ============================================================
-- STYLE CATALOG TABLE
-- Master list of braiding styles with images and metadata.
-- Mirrors Pinecone style_catalog namespace for structured queries.
-- ============================================================
CREATE TABLE style_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  
  -- Classification
  category VARCHAR(100) NOT NULL, -- 'braids', 'locs', 'twists', 'cornrows', 'crochet'
  sub_category VARCHAR(100),       -- 'box_braids', 'goddess_locs', 'passion_twists', etc.
  
  -- Compatibility
  compatible_textures TEXT[] DEFAULT '{}', -- {'3c', '4a', '4b', '4c', 'all'}
  min_hair_length VARCHAR(50),             -- 'chin', 'shoulder', 'armpit', 'waist'
  
  -- Service info
  install_time_hours_min DECIMAL(3,1),
  install_time_hours_max DECIMAL(3,1),
  price_min DECIMAL(10,2),
  price_max DECIMAL(10,2),
  longevity_weeks_min INT,
  longevity_weeks_max INT,
  
  -- Media
  image_urls TEXT[] DEFAULT '{}',
  thumbnail_url VARCHAR(500),
  
  -- Content
  description TEXT,
  maintenance_tips TEXT,
  
  -- Metrics
  popularity_score INT DEFAULT 50, -- 0-100
  tags TEXT[] DEFAULT '{}',        -- {'protective', 'trendy', 'low_maintenance', 'formal'}
  
  -- RAG reference
  pinecone_vector_id VARCHAR(255),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_styles_category ON style_catalog(category);
CREATE INDEX idx_styles_sub_category ON style_catalog(sub_category);
CREATE INDEX idx_styles_active ON style_catalog(is_active) WHERE is_active = true;
CREATE INDEX idx_styles_popularity ON style_catalog(popularity_score DESC);

CREATE TRIGGER trg_styles_updated
  BEFORE UPDATE ON style_catalog
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ERROR LOG TABLE
-- Centralized error tracking for all N8N workflows.
-- ============================================================
CREATE TABLE error_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_name VARCHAR(255) NOT NULL,
  node_name VARCHAR(255),
  error_message TEXT NOT NULL,
  error_stack TEXT,
  customer_id UUID REFERENCES customers(id),
  channel VARCHAR(20),
  severity VARCHAR(20) DEFAULT 'warning'
    CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_errors_workflow ON error_log(workflow_name);
CREATE INDEX idx_errors_severity ON error_log(severity);
CREATE INDEX idx_errors_created ON error_log(created_at);
CREATE INDEX idx_errors_unresolved ON error_log(resolved) WHERE resolved = false;

-- ============================================================
-- ANALYTICS EVENTS TABLE
-- Track usage patterns for dashboard + reporting.
-- ============================================================
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  -- 'chat_started', 'call_started', 'appointment_booked', 'appointment_cancelled',
  -- 'style_recommended', 'image_analyzed', 'customer_created'
  customer_id UUID REFERENCES customers(id),
  channel VARCHAR(20),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analytics_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_created ON analytics_events(created_at);
CREATE INDEX idx_analytics_customer ON analytics_events(customer_id);

-- ============================================================
-- SEED DATA: Initial Style Catalog
-- ============================================================
INSERT INTO style_catalog (name, slug, category, sub_category, compatible_textures,
  min_hair_length, install_time_hours_min, install_time_hours_max,
  price_min, price_max, longevity_weeks_min, longevity_weeks_max,
  description, maintenance_tips, tags, popularity_score) VALUES

('Knotless Box Braids', 'knotless-box-braids', 'braids', 'box_braids',
 '{"3c","4a","4b","4c","all"}', 'chin', 4, 8, 150, 350, 6, 8,
 'Knotless box braids start with your natural hair and gradually feed in extensions for a seamless, pain-free install. Available in small, medium, or large sizes.',
 'Wrap with a silk scarf at night. Moisturize scalp every 2-3 days. Avoid heavy products that cause buildup.',
 '{"protective","versatile","popular","low_maintenance"}', 95),

('Goddess Locs', 'goddess-locs', 'locs', 'goddess_locs',
 '{"3b","3c","4a","4b","4c","all"}', 'chin', 5, 8, 180, 350, 8, 12,
 'Soft, flowing faux locs with loose curly ends for a bohemian goddess aesthetic. Lightweight and versatile.',
 'Keep locs moisturized with light oil spray. Sleep with a bonnet. Refresh curly ends with mousse as needed.',
 '{"protective","trendy","bohemian","romantic"}', 90),

('Passion Twists', 'passion-twists', 'twists', 'passion_twists',
 '{"3c","4a","4b","4c","all"}', 'chin', 3, 6, 140, 280, 6, 8,
 'Soft, springy twists using passion twist hair for a romantic, textured look. Lighter than traditional twists.',
 'Dip ends in hot water to seal. Moisturize with light spray. Avoid over-manipulation.',
 '{"protective","trendy","lightweight","romantic"}', 85),

('Feed-In Cornrows', 'feed-in-cornrows', 'cornrows', 'feed_in',
 '{"3a","3b","3c","4a","4b","4c","all"}', 'ear', 2, 5, 80, 200, 2, 4,
 'Stitch-style cornrows that start thin and gradually thicken with added hair. Endless pattern possibilities.',
 'Keep scalp moisturized. Wear a durag or scarf at night. Touch up edges as needed.',
 '{"protective","classic","athletic","cultural"}', 80),

('Butterfly Locs', 'butterfly-locs', 'locs', 'butterfly_locs',
 '{"3c","4a","4b","4c","all"}', 'chin', 5, 8, 180, 320, 8, 12,
 'Distressed faux locs with a messy, looped texture for a bohemian-chic vibe. Extremely lightweight.',
 'Gentle moisturizing spray every few days. Sleep in a satin bonnet. Avoid washing — use dry shampoo if needed.',
 '{"protective","trendy","bohemian","lightweight"}', 88),

('Fulani Braids', 'fulani-braids', 'braids', 'fulani',
 '{"3b","3c","4a","4b","4c","all"}', 'ear', 3, 6, 120, 250, 3, 6,
 'Traditional braiding pattern featuring a center braid with side cornrows and loose braids. Often decorated with beads and cuffs.',
 'Keep braids moisturized. Wrap at night. Add accessories carefully to avoid tension.',
 '{"cultural","traditional","decorative","formal"}', 75),

('Crochet Braids', 'crochet-braids', 'crochet', 'crochet_braids',
 '{"3a","3b","3c","4a","4b","4c","all"}', 'ear', 2, 4, 80, 180, 4, 8,
 'Quick-install protective style using the crochet method. Pre-looped or loose hair attached to cornrow base.',
 'Moisturize natural hair underneath. Avoid heavy pulling on loops. Can be washed gently.',
 '{"protective","quick_install","versatile","budget_friendly"}', 70),

('Tribal Braids', 'tribal-braids', 'braids', 'tribal',
 '{"3c","4a","4b","4c","all"}', 'chin', 4, 7, 150, 300, 4, 6,
 'Bold braiding patterns combining cornrows with large free-hanging braids. Intricate, statement-making style.',
 'Wrap at night. Keep scalp clean with witch hazel. Moisturize every 2-3 days.',
 '{"statement","bold","cultural","protective"}', 82);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Enable after setting up Supabase auth
-- ============================================================
-- ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE interaction_log ENABLE ROW LEVEL SECURITY;

-- Service role (N8N backend) gets full access:
-- CREATE POLICY "service_role_all" ON customers FOR ALL
--   USING (auth.role() = 'service_role');

-- ============================================================
-- USEFUL VIEWS
-- ============================================================

-- Upcoming appointments with customer details
CREATE VIEW upcoming_appointments AS
SELECT 
  a.id AS appointment_id,
  c.name AS customer_name,
  c.phone AS customer_phone,
  a.service_type,
  a.start_time,
  a.end_time,
  a.duration_minutes,
  a.stylist_name,
  a.status,
  a.notes,
  a.channel_booked
FROM appointments a
JOIN customers c ON a.customer_id = c.id
WHERE a.start_time > NOW()
  AND a.status = 'confirmed'
ORDER BY a.start_time ASC;

-- Customer engagement summary
CREATE VIEW customer_engagement AS
SELECT
  c.id,
  c.name,
  c.phone,
  c.lifetime_visits,
  c.lifetime_spend,
  c.last_seen,
  c.hair_profile,
  COUNT(DISTINCT il.session_id) AS total_sessions,
  COUNT(CASE WHEN il.channel = 'web' THEN 1 END) AS web_sessions,
  COUNT(CASE WHEN il.channel = 'voice' THEN 1 END) AS voice_sessions,
  MAX(il.created_at) AS last_interaction
FROM customers c
LEFT JOIN interaction_log il ON c.id = il.customer_id
GROUP BY c.id;

-- Daily booking analytics
CREATE VIEW daily_booking_stats AS
SELECT
  DATE(created_at) AS booking_date,
  COUNT(*) AS total_bookings,
  COUNT(CASE WHEN channel_booked = 'web' THEN 1 END) AS web_bookings,
  COUNT(CASE WHEN channel_booked = 'voice' THEN 1 END) AS voice_bookings,
  COUNT(CASE WHEN status = 'cancelled' THEN 1 END) AS cancellations,
  SUM(price_quoted) AS total_quoted_revenue
FROM appointments
GROUP BY DATE(created_at)
ORDER BY booking_date DESC;
