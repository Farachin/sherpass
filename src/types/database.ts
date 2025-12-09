/**
 * TypeScript Interfaces für das Sherpass Datenbank-Schema
 * Basierend auf supabase_setup.sql und add_delivery_code.sql
 */

// ============================================
// ENUMS
// ============================================

export type ShipmentStatus =
  | "pending"
  | "accepted"
  | "shipping_to_sherpa"
  | "in_transit"
  | "delivered"
  | "rejected"
  | "completed"; // completed ist ein Alias für delivered

export type MessageType = "text" | "booking_request";

// ============================================
// BASE TABLES (direkt aus der Datenbank)
// ============================================

/**
 * Profiles Tabelle
 */
export interface Profile {
  id: string; // UUID
  first_name: string | null;
  trust_score?: number | null; // NUMERIC(3,2)
  created_at: string; // TIMESTAMPTZ
  updated_at: string; // TIMESTAMPTZ
}

/**
 * Trips Tabelle
 */
export interface Trip {
  id: string; // UUID
  user_id: string; // UUID NOT NULL
  origin: string; // TEXT NOT NULL
  destination: string; // TEXT NOT NULL
  date: string; // DATE NOT NULL (ISO date string)
  capacity_kg: number; // NUMERIC(5,2) NOT NULL
  sherpa_name: string; // TEXT NOT NULL
  description: string | null; // TEXT
  price_eur: number | null; // NUMERIC(10,2)
  origin_country: string | null; // TEXT
  destination_country: string | null; // TEXT
  created_at: string; // TIMESTAMPTZ
  updated_at: string; // TIMESTAMPTZ
}

/**
 * Shipments Tabelle
 */
export interface Shipment {
  id: string; // UUID
  user_id: string; // UUID NOT NULL
  trip_id: string | null; // UUID (kann NULL sein)
  content_desc: string; // TEXT NOT NULL
  weight_kg: number; // NUMERIC(5,2) NOT NULL
  value_eur: number; // NUMERIC(10,2) NOT NULL
  sender_name: string; // TEXT NOT NULL
  status: ShipmentStatus; // TEXT NOT NULL DEFAULT 'pending'
  delivery_code: string | null; // UUID (wurde später hinzugefügt)
  tracking_provider?: string | null; // TEXT
  tracking_id?: string | null; // TEXT
  created_at: string; // TIMESTAMPTZ
  updated_at: string; // TIMESTAMPTZ
}

/**
 * Conversations Tabelle
 */
export interface Conversation {
  id: string; // UUID
  participant1_id: string; // UUID NOT NULL
  participant2_id: string; // UUID NOT NULL
  created_at: string; // TIMESTAMPTZ
}

/**
 * Messages Tabelle
 */
export interface Message {
  id: string; // UUID
  conversation_id: string; // UUID NOT NULL
  sender_id: string; // UUID NOT NULL
  content: string; // TEXT NOT NULL
  type: MessageType; // TEXT NOT NULL DEFAULT 'text'
  shipment_id: string | null; // UUID (kann NULL sein)
  created_at: string; // TIMESTAMPTZ
}

/**
 * Reviews Tabelle
 */
export interface Review {
  id: string; // UUID
  reviewer_id: string; // UUID NOT NULL
  reviewed_id: string; // UUID NOT NULL
  rating: number; // INTEGER NOT NULL (1-5)
  comment: string | null; // TEXT
  created_at: string; // TIMESTAMPTZ
}

/**
 * BlockedUsers Tabelle
 */
export interface BlockedUser {
  id: string; // UUID
  blocker_id: string; // UUID NOT NULL
  blocked_id: string; // UUID NOT NULL
  created_at: string; // TIMESTAMPTZ
}

// ============================================
// JOINED/EXTENDED TYPES (mit Relations)
// ============================================

/**
 * Trip mit optionalen Relations (z.B. aus Supabase Select mit Joins)
 */
export interface TripWithRelations extends Trip {
  shipments?: Shipment[];
  user?: Profile;
}

/**
 * Shipment mit optionalen Relations
 */
export interface ShipmentWithRelations extends Shipment {
  trips?: Trip | Trip[]; // Kann als Objekt oder Array kommen (Supabase Join)
  user?: Profile;
}

/**
 * Message mit optionalen Relations
 */
export interface MessageWithRelations extends Message {
  shipments?: ShipmentWithRelations | ShipmentWithRelations[];
  sender?: Profile;
}

/**
 * Conversation mit optionalen Relations und berechneten Feldern
 */
export interface ConversationWithDetails extends Conversation {
  partnerId?: string; // Berechnet: der andere Teilnehmer
  partnerName?: string; // Aus Profile geladen
  lastMessage?: MessageWithRelations | null;
  tripContext?: {
    origin: string;
    destination: string;
  } | null;
  lastMessageTime?: string; // created_at von lastMessage oder conversation
}

/**
 * BookingMessage: Spezieller Typ für booking_request Messages mit Shipment
 */
export interface BookingMessage {
  id: string; // Message ID
  conversation_id?: string;
  shipments?: ShipmentWithRelations; // Das zugehörige Shipment
  trips?: Trip | Trip[]; // Trip Info (kann über shipment.trips kommen)
}

/**
 * BlockedUser mit Relations
 */
export interface BlockedUserWithRelations extends BlockedUser {
  blocked?: {
    id: string;
    email?: string | null;
  };
}

// ============================================
// UTILITY TYPES
// ============================================

/**
 * Supabase Query Response Type
 */
export type SupabaseResponse<T> = {
  data: T | null;
  error: Error | null;
};

/**
 * Partial Shipment für Updates (alle Felder optional außer id)
 */
export type ShipmentUpdate = Partial<Omit<Shipment, "id" | "created_at">> & {
  id: string;
};

/**
 * Partial Trip für Updates
 */
export type TripUpdate = Partial<Omit<Trip, "id" | "created_at">> & {
  id: string;
};
