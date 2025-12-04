-- ============================================
-- SHERPASS DATENBANK RESET
-- ============================================
-- Führe dieses Skript im Supabase SQL Editor aus
-- Es löscht alle Tabellen und erstellt sie neu mit korrekten RLS Policies

-- ============================================
-- 1. ALTE STRUKTUR LÖSCHEN (CASCADE)
-- ============================================

DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS shipments CASCADE;
DROP TABLE IF EXISTS trips CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS blocked_users CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Trigger löschen
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- ============================================
-- 2. TABELLEN ERSTELLEN
-- ============================================

-- Profiles (User-Profile)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trips (Reiseangebote)
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  date DATE NOT NULL,
  capacity_kg NUMERIC(5,2) NOT NULL,
  sherpa_name TEXT NOT NULL,
  description TEXT,
  price_eur NUMERIC(10,2),
  origin_country TEXT,
  destination_country TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shipments (Pakete/Sendungen)
CREATE TABLE shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  content_desc TEXT NOT NULL,
  weight_kg NUMERIC(5,2) NOT NULL,
  value_eur NUMERIC(10,2) NOT NULL,
  sender_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  tracking_provider TEXT,
  tracking_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (status IN ('pending', 'accepted', 'shipping_to_sherpa', 'in_transit', 'delivered', 'rejected'))
);

-- Conversations (Chat-Konversationen)
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participant2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(participant1_id, participant2_id)
);

-- Messages (Chat-Nachrichten)
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text',
  shipment_id UUID REFERENCES shipments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (type IN ('text', 'booking_request'))
);

-- Reports (Meldungen)
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  context TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blocked Users (Blockierungen)
CREATE TABLE blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);

-- ============================================
-- 3. TRIGGER FÜR PROFILERSTELLUNG
-- ============================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'first_name', 'Sherpa'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================
-- 4. RLS (ROW LEVEL SECURITY) POLICIES
-- ============================================

-- RLS aktivieren
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROFILES POLICIES
-- ============================================

-- Jeder kann Profile lesen
CREATE POLICY "Profiles sind öffentlich lesbar"
  ON profiles FOR SELECT
  USING (true);

-- Nur der User kann sein Profil updaten
CREATE POLICY "User kann eigenes Profil updaten"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- ============================================
-- TRIPS POLICIES (WICHTIG: PUBLIC READ!)
-- ============================================

-- WICHTIG: Jeder (auch nicht eingeloggt) kann Trips lesen
CREATE POLICY "Trips sind öffentlich lesbar"
  ON trips FOR SELECT
  USING (true);

-- Nur der Owner kann Trips erstellen
CREATE POLICY "User kann eigene Trips erstellen"
  ON trips FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Nur der Owner kann Trips updaten
CREATE POLICY "User kann eigene Trips updaten"
  ON trips FOR UPDATE
  USING (auth.uid() = user_id);

-- Nur der Owner kann Trips löschen
CREATE POLICY "User kann eigene Trips löschen"
  ON trips FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- SHIPMENTS POLICIES
-- ============================================

-- User kann nur eigene Shipments lesen
CREATE POLICY "User kann eigene Shipments lesen"
  ON shipments FOR SELECT
  USING (auth.uid() = user_id);

-- User kann nur eigene Shipments erstellen
CREATE POLICY "User kann eigene Shipments erstellen"
  ON shipments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- User kann nur eigene Shipments updaten
CREATE POLICY "User kann eigene Shipments updaten"
  ON shipments FOR UPDATE
  USING (auth.uid() = user_id);

-- User kann nur eigene Shipments löschen
CREATE POLICY "User kann eigene Shipments löschen"
  ON shipments FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- CONVERSATIONS POLICIES
-- ============================================

-- User kann nur Conversations lesen, an denen er beteiligt ist
CREATE POLICY "User kann eigene Conversations lesen"
  ON conversations FOR SELECT
  USING (auth.uid() = participant1_id OR auth.uid() = participant2_id);

-- User kann Conversations erstellen, wenn er Teilnehmer ist
CREATE POLICY "User kann Conversations erstellen"
  ON conversations FOR INSERT
  WITH CHECK (auth.uid() = participant1_id OR auth.uid() = participant2_id);

-- ============================================
-- MESSAGES POLICIES
-- ============================================

-- User kann Messages lesen, wenn er an der Conversation beteiligt ist
CREATE POLICY "User kann Messages in eigenen Conversations lesen"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND (conversations.participant1_id = auth.uid() OR conversations.participant2_id = auth.uid())
    )
  );

-- User kann Messages erstellen, wenn er Sender ist und an der Conversation beteiligt
CREATE POLICY "User kann Messages in eigenen Conversations erstellen"
  ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND (conversations.participant1_id = auth.uid() OR conversations.participant2_id = auth.uid())
    )
  );

-- ============================================
-- REPORTS POLICIES
-- ============================================

-- User kann nur eigene Reports lesen
CREATE POLICY "User kann eigene Reports lesen"
  ON reports FOR SELECT
  USING (auth.uid() = reporter_id);

-- User kann Reports erstellen
CREATE POLICY "User kann Reports erstellen"
  ON reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

-- ============================================
-- BLOCKED_USERS POLICIES
-- ============================================

-- User kann nur eigene Blockierungen lesen
CREATE POLICY "User kann eigene Blockierungen lesen"
  ON blocked_users FOR SELECT
  USING (auth.uid() = blocker_id);

-- User kann Blockierungen erstellen
CREATE POLICY "User kann Blockierungen erstellen"
  ON blocked_users FOR INSERT
  WITH CHECK (auth.uid() = blocker_id);

-- User kann Blockierungen löschen
CREATE POLICY "User kann eigene Blockierungen löschen"
  ON blocked_users FOR DELETE
  USING (auth.uid() = blocker_id);

-- ============================================
-- 5. TEST-DATEN EINFÜGEN
-- ============================================
-- WICHTIG: Diese Daten werden nur eingefügt, wenn auth.users existieren
-- 
-- ANLEITUNG FÜR TEST-DATEN:
-- 1. Erstelle zuerst 5 Test-User über die Supabase Auth-UI oder die App
-- 2. Kopiere die User-IDs aus auth.users
-- 3. Führe dann diesen Block aus (ersetze USER_ID_1 bis USER_ID_5):

/*
-- Beispiel: Test-Trips einfügen (nach User-Erstellung)
-- Ersetze die Platzhalter mit echten User-IDs aus auth.users

INSERT INTO trips (user_id, origin, destination, date, capacity_kg, sherpa_name, description, origin_country, destination_country)
VALUES
  (
    (SELECT id FROM auth.users LIMIT 1 OFFSET 0), -- Ersetze mit echter User-ID
    'Frankfurt (FRA)', 
    'Kabul (KBL)', 
    (CURRENT_DATE + INTERVAL '15 days'), 
    20.00, 
    'Ahmad', 
    'Direktflug nach Kabul, kann Pakete mitnehmen.', 
    'DE', 
    'AF'
  ),
  (
    (SELECT id FROM auth.users LIMIT 1 OFFSET 1), -- Ersetze mit echter User-ID
    'Berlin (BER)', 
    'Teheran (IKA)', 
    (CURRENT_DATE + INTERVAL '22 days'), 
    15.00, 
    'Maria', 
    'Reise nach Teheran, freier Platz im Gepäck.', 
    'DE', 
    'IR'
  ),
  (
    (SELECT id FROM auth.users LIMIT 1 OFFSET 2), -- Ersetze mit echter User-ID
    'Hamburg (HAM)', 
    'Mazar-i-Sharif (MZR)', 
    (CURRENT_DATE + INTERVAL '30 days'), 
    25.00, 
    'Ali', 
    'Geschäftsreise, kann Sendungen transportieren.', 
    'DE', 
    'AF'
  ),
  (
    (SELECT id FROM auth.users LIMIT 1 OFFSET 3), -- Ersetze mit echter User-ID
    'München (MUC)', 
    'Dubai (DXB)', 
    (CURRENT_DATE + INTERVAL '18 days'), 
    10.00, 
    'Lisa', 
    'Urlaubsreise, wenig Gepäck.', 
    'DE', 
    'UAE'
  ),
  (
    (SELECT id FROM auth.users LIMIT 1 OFFSET 4), -- Ersetze mit echter User-ID
    'Frankfurt (FRA)', 
    'Istanbul (IST)', 
    (CURRENT_DATE + INTERVAL '12 days'), 
    30.00, 
    'Karim', 
    'Regelmäßige Reise nach Istanbul.', 
    'DE', 
    'TR'
  );

-- ALTERNATIVE: Wenn du bereits User-IDs hast, verwende diese direkt:
-- INSERT INTO trips (user_id, origin, destination, date, capacity_kg, sherpa_name, description, origin_country, destination_country)
-- VALUES
--   ('DEINE-USER-ID-1', 'Frankfurt (FRA)', 'Kabul (KBL)', (CURRENT_DATE + INTERVAL '15 days'), 20.00, 'Ahmad', 'Direktflug nach Kabul, kann Pakete mitnehmen.', 'DE', 'AF'),
--   ('DEINE-USER-ID-2', 'Berlin (BER)', 'Teheran (IKA)', (CURRENT_DATE + INTERVAL '22 days'), 15.00, 'Maria', 'Reise nach Teheran, freier Platz im Gepäck.', 'DE', 'IR'),
--   ... usw.
*/

-- ============================================
-- 6. INDEXES FÜR PERFORMANCE
-- ============================================

CREATE INDEX idx_trips_user_id ON trips(user_id);
CREATE INDEX idx_trips_date ON trips(date);
CREATE INDEX idx_trips_origin ON trips(origin);
CREATE INDEX idx_trips_destination ON trips(destination);
CREATE INDEX idx_trips_origin_country ON trips(origin_country);
CREATE INDEX idx_trips_destination_country ON trips(destination_country);

CREATE INDEX idx_shipments_user_id ON shipments(user_id);
CREATE INDEX idx_shipments_trip_id ON shipments(trip_id);
CREATE INDEX idx_shipments_status ON shipments(status);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);

CREATE INDEX idx_conversations_participants ON conversations(participant1_id, participant2_id);

-- ============================================
-- FERTIG!
-- ============================================
-- Nach dem Ausführen:
-- 1. Erstelle Test-User über die Auth-UI
-- 2. Passe die Test-Trips oben an (ersetze USER_ID_X mit echten IDs)
-- 3. Oder erstelle Trips direkt über die App

