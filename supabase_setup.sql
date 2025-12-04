-- ============================================
-- SHERPASS DATENBANK SETUP
-- ============================================
-- Führe dieses Skript im Supabase SQL Editor aus
-- Es löscht alle Tabellen und erstellt sie komplett neu

-- ============================================
-- 1. ALTE STRUKTUR LÖSCHEN (CASCADE)
-- ============================================

DROP TABLE IF EXISTS reviews CASCADE;
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
  trust_score NUMERIC(3,2) DEFAULT 5.00,
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

-- Reviews (Bewertungen)
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewed_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(reviewer_id, reviewed_id)
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
-- WICHTIG: Public Read für alle Tabellen (damit Suche ohne Login funktioniert)

-- RLS aktivieren
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROFILES POLICIES
-- ============================================

-- Public Read
CREATE POLICY "Profiles sind öffentlich lesbar"
  ON profiles FOR SELECT
  USING (true);

-- Authenticated Insert (wird durch Trigger gemacht, aber für Sicherheit)
CREATE POLICY "Authenticated kann Profile erstellen"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- User kann eigenes Profil updaten
CREATE POLICY "User kann eigenes Profil updaten"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- ============================================
-- TRIPS POLICIES (WICHTIG: PUBLIC READ!)
-- ============================================

-- Public Read (für Suche ohne Login)
CREATE POLICY "Trips sind öffentlich lesbar"
  ON trips FOR SELECT
  USING (true);

-- Authenticated Insert
CREATE POLICY "Authenticated kann Trips erstellen"
  ON trips FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Authenticated Update (nur Owner)
CREATE POLICY "User kann eigene Trips updaten"
  ON trips FOR UPDATE
  USING (auth.uid() = user_id);

-- Authenticated Delete (nur Owner)
CREATE POLICY "User kann eigene Trips löschen"
  ON trips FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- SHIPMENTS POLICIES
-- ============================================

-- Public Read
CREATE POLICY "Shipments sind öffentlich lesbar"
  ON shipments FOR SELECT
  USING (true);

-- Authenticated Insert
CREATE POLICY "Authenticated kann Shipments erstellen"
  ON shipments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Authenticated Update (nur Owner)
CREATE POLICY "User kann eigene Shipments updaten"
  ON shipments FOR UPDATE
  USING (auth.uid() = user_id);

-- Authenticated Delete (nur Owner)
CREATE POLICY "User kann eigene Shipments löschen"
  ON shipments FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- CONVERSATIONS POLICIES
-- ============================================

-- Public Read (für Chat-Funktionalität)
CREATE POLICY "Conversations sind öffentlich lesbar"
  ON conversations FOR SELECT
  USING (true);

-- Authenticated Insert
CREATE POLICY "Authenticated kann Conversations erstellen"
  ON conversations FOR INSERT
  WITH CHECK (auth.uid() = participant1_id OR auth.uid() = participant2_id);

-- ============================================
-- MESSAGES POLICIES
-- ============================================

-- Public Read (für Chat-Funktionalität)
CREATE POLICY "Messages sind öffentlich lesbar"
  ON messages FOR SELECT
  USING (true);

-- Authenticated Insert
CREATE POLICY "Authenticated kann Messages erstellen"
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

-- Public Read
CREATE POLICY "Reports sind öffentlich lesbar"
  ON reports FOR SELECT
  USING (true);

-- Authenticated Insert
CREATE POLICY "Authenticated kann Reports erstellen"
  ON reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

-- ============================================
-- BLOCKED_USERS POLICIES
-- ============================================

-- Public Read
CREATE POLICY "Blocked Users sind öffentlich lesbar"
  ON blocked_users FOR SELECT
  USING (true);

-- Authenticated Insert
CREATE POLICY "Authenticated kann Blockierungen erstellen"
  ON blocked_users FOR INSERT
  WITH CHECK (auth.uid() = blocker_id);

-- Authenticated Delete (nur Owner)
CREATE POLICY "User kann eigene Blockierungen löschen"
  ON blocked_users FOR DELETE
  USING (auth.uid() = blocker_id);

-- ============================================
-- REVIEWS POLICIES
-- ============================================

-- Public Read
CREATE POLICY "Reviews sind öffentlich lesbar"
  ON reviews FOR SELECT
  USING (true);

-- Authenticated Insert
CREATE POLICY "Authenticated kann Reviews erstellen"
  ON reviews FOR INSERT
  WITH CHECK (auth.uid() = reviewer_id);

-- Authenticated Update (nur Owner)
CREATE POLICY "User kann eigene Reviews updaten"
  ON reviews FOR UPDATE
  USING (auth.uid() = reviewer_id);

-- Authenticated Delete (nur Owner)
CREATE POLICY "User kann eigene Reviews löschen"
  ON reviews FOR DELETE
  USING (auth.uid() = reviewer_id);

-- ============================================
-- 5. INDEXES FÜR PERFORMANCE
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
-- 6. SEED DATA (TEST-REISEN)
-- ============================================
-- WICHTIG: Diese Seed-Daten funktionieren nur, wenn bereits User existieren!
-- Erstelle zuerst 3 Test-User über die Auth-UI, dann führe diesen Block aus.

-- Beispiel: Wenn du User-IDs hast, ersetze die Platzhalter
-- ODER verwende die erste verfügbare User-ID aus auth.users

DO $$
DECLARE
  user1_id UUID;
  user2_id UUID;
  user3_id UUID;
BEGIN
  -- Versuche, die ersten 3 User-IDs zu holen
  SELECT id INTO user1_id FROM auth.users ORDER BY created_at LIMIT 1 OFFSET 0;
  SELECT id INTO user2_id FROM auth.users ORDER BY created_at LIMIT 1 OFFSET 1;
  SELECT id INTO user3_id FROM auth.users ORDER BY created_at LIMIT 1 OFFSET 2;

  -- Nur einfügen, wenn User existieren
  IF user1_id IS NOT NULL THEN
    INSERT INTO trips (user_id, origin, destination, date, capacity_kg, sherpa_name, description, origin_country, destination_country)
    VALUES (
      user1_id,
      'Frankfurt (FRA)',
      'Kabul (KBL)',
      CURRENT_DATE + INTERVAL '15 days',
      20.00,
      'Ahmad',
      'Direktflug nach Kabul. Kann Pakete bis 20kg mitnehmen. Sichere Hand-zu-Hand Übergabe.',
      'DE',
      'AF'
    ) ON CONFLICT DO NOTHING;
  END IF;

  IF user2_id IS NOT NULL THEN
    INSERT INTO trips (user_id, origin, destination, date, capacity_kg, sherpa_name, description, origin_country, destination_country)
    VALUES (
      user2_id,
      'Berlin (BER)',
      'Istanbul (IST)',
      CURRENT_DATE + INTERVAL '22 days',
      15.00,
      'Maria',
      'Geschäftsreise nach Istanbul. Freier Platz im Gepäck für Sendungen.',
      'DE',
      'TR'
    ) ON CONFLICT DO NOTHING;
  END IF;

  IF user3_id IS NOT NULL THEN
    INSERT INTO trips (user_id, origin, destination, date, capacity_kg, sherpa_name, description, origin_country, destination_country)
    VALUES (
      user3_id,
      'Hamburg (HAM)',
      'Mazar-i-Sharif (MZR)',
      CURRENT_DATE + INTERVAL '30 days',
      25.00,
      'Ali',
      'Regelmäßige Reise nach Mazar-i-Sharif. Kann größere Sendungen transportieren.',
      'DE',
      'AF'
    ) ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================
-- FERTIG!
-- ============================================
-- Nach dem Ausführen:
-- 1. Erstelle 3 Test-User über die Supabase Auth-UI
-- 2. Führe das Seed-Data-Skript erneut aus (oder passe die User-IDs an)
-- 3. Teste die App!

