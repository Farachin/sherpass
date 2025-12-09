/**
 * Supabase Client Types
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Profile,
  Trip,
  Shipment,
  Conversation,
  Message,
  Review,
  BlockedUser,
} from "./database";

/**
 * Database Schema für Supabase
 */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Profile, "id" | "created_at">>;
      };
      trips: {
        Row: Trip;
        Insert: Omit<Trip, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Trip, "id" | "created_at">>;
      };
      shipments: {
        Row: Shipment;
        Insert: Omit<Shipment, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Shipment, "id" | "created_at">>;
      };
      conversations: {
        Row: Conversation;
        Insert: Omit<Conversation, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Conversation, "id" | "created_at">>;
      };
      messages: {
        Row: Message;
        Insert: Omit<Message, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Message, "id" | "created_at">>;
      };
      reviews: {
        Row: Review;
        Insert: Omit<Review, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Review, "id" | "created_at">>;
      };
      blocked_users: {
        Row: BlockedUser;
        Insert: Omit<BlockedUser, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<BlockedUser, "id" | "created_at">>;
      };
    };
  };
}

/**
 * Typisierter Supabase Client
 */
export type TypedSupabaseClient = SupabaseClient<Database>;
