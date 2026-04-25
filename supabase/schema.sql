-- Keyby Real Estate Platform Schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Properties
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  address TEXT,
  district TEXT,
  price NUMERIC,
  deposit NUMERIC,
  type TEXT CHECK (type IN ('room', 'studio', '1k', '2k', '3k', '4k+', 'house', 'other')),
  rooms INTEGER,
  area NUMERIC,
  floor INTEGER,
  total_floors INTEGER,
  lat NUMERIC,
  lng NUMERIC,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'waiting_photos' CHECK (status IN ('waiting_photos', 'draft', 'published', 'archived')),
  photos TEXT[] DEFAULT '{}',
  source_chat_id TEXT,
  source_chat_name TEXT,
  source_account TEXT,
  sender_phone TEXT,
  raw_message TEXT,
  property_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clients
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  districts TEXT[] DEFAULT '{}',
  price_min NUMERIC,
  price_max NUMERIC,
  rooms INTEGER[] DEFAULT '{}',
  area_min NUMERIC,
  notes TEXT,
  agent_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- WA Accounts
CREATE TABLE wa_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT,
  label TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connecting', 'active', 'disconnected', 'banned')),
  chats_count INTEGER DEFAULT 0,
  messages_parsed INTEGER DEFAULT 0,
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- WA Chats (groups each account is monitoring)
CREATE TABLE wa_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES wa_accounts(id) ON DELETE CASCADE,
  chat_jid TEXT NOT NULL,
  chat_name TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  messages_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, chat_jid)
);

-- Photo requests log
CREATE TABLE photo_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  sender_phone TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER properties_updated_at BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER clients_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_requests ENABLE ROW LEVEL SECURITY;

-- Public: read published properties only
CREATE POLICY "public_read_published" ON properties
  FOR SELECT USING (status = 'published');

-- Authenticated: full access to everything
CREATE POLICY "auth_all_properties" ON properties
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "auth_all_clients" ON clients
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "auth_all_wa_accounts" ON wa_accounts
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "auth_all_wa_chats" ON wa_chats
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "auth_all_photo_requests" ON photo_requests
  FOR ALL USING (auth.role() = 'authenticated');

-- Service role bypass for parser (used via service_role key)
CREATE POLICY "service_insert_properties" ON properties
  FOR INSERT WITH CHECK (true);

CREATE POLICY "service_update_properties" ON properties
  FOR UPDATE USING (true);

-- Atomic counter increment for parser
-- Enable realtime for properties table
ALTER PUBLICATION supabase_realtime ADD TABLE properties;

CREATE OR REPLACE FUNCTION increment_messages_parsed(p_account_id UUID)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE wa_accounts SET messages_parsed = messages_parsed + 1 WHERE id = p_account_id;
$$;
