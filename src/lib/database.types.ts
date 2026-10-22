export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      appointment_horses: {
        Row: {
          appointment_id: string
          horse_id: string
          planned_service_id: string | null
        }
        Insert: {
          appointment_id: string
          horse_id: string
          planned_service_id?: string | null
        }
        Update: {
          appointment_id?: string
          horse_id?: string
          planned_service_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_horses_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_horses_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_horses_planned_service_id_fkey"
            columns: ["planned_service_id"]
            isOneToOne: false
            referencedRelation: "provider_services"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          created_at: string
          id: string
          location_id: string | null
          notes: string | null
          owner_confirmed_at: string | null
          planned_km: number | null
          provider_id: string
          request_id: string | null
          route_order: number | null
          scheduled_end: string | null
          scheduled_start: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_id?: string | null
          notes?: string | null
          owner_confirmed_at?: string | null
          planned_km?: number | null
          provider_id: string
          request_id?: string | null
          route_order?: number | null
          scheduled_end?: string | null
          scheduled_start: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string | null
          notes?: string | null
          owner_confirmed_at?: string | null
          planned_km?: number | null
          provider_id?: string
          request_id?: string | null
          route_order?: number | null
          scheduled_end?: string | null
          scheduled_start?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "visit_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      client_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          client_id: string
          created_at: string
          expires_at: string
          id: string
          sent_to: string | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          client_id: string
          created_at?: string
          expires_at?: string
          id?: string
          sent_to?: string | null
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          client_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          sent_to?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_invites_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_invites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notes: {
        Row: {
          client_id: string
          notes: string
          provider_id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          notes?: string
          provider_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          notes?: string
          provider_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notes_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          archived_at: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          linked_user_id: string | null
          phone: string | null
          provider_id: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          linked_user_id?: string | null
          phone?: string | null
          provider_id: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          linked_user_id?: string | null
          phone?: string | null
          provider_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_linked_user_id_fkey"
            columns: ["linked_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      horse_notes: {
        Row: {
          horse_id: string
          notes: string
          provider_id: string
          updated_at: string
        }
        Insert: {
          horse_id: string
          notes?: string
          provider_id: string
          updated_at?: string
        }
        Update: {
          horse_id?: string
          notes?: string
          provider_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "horse_notes_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horse_notes_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      horse_owners: {
        Row: {
          client_id: string | null
          created_at: string
          horse_id: string
          id: string
          is_primary: boolean
          user_id: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          horse_id: string
          id?: string
          is_primary?: boolean
          user_id?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          horse_id?: string
          id?: string
          is_primary?: boolean
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "horse_owners_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horse_owners_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horse_owners_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      horse_permission_grants: {
        Row: {
          enabled: boolean
          granted_by: string
          horse_id: string
          id: string
          permission: Database["public"]["Enums"]["permission_type"]
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          granted_by: string
          horse_id: string
          id?: string
          permission: Database["public"]["Enums"]["permission_type"]
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          granted_by?: string
          horse_id?: string
          id?: string
          permission?: Database["public"]["Enums"]["permission_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "horse_permission_grants_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horse_permission_grants_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id"]
          },
        ]
      }
      horse_providers: {
        Row: {
          attached_at: string
          attached_by: string | null
          detached_at: string | null
          horse_id: string
          id: string
          interval_weeks: number | null
          role: Database["public"]["Enums"]["provider_role"]
          status: Database["public"]["Enums"]["provider_status"]
          user_id: string
        }
        Insert: {
          attached_at?: string
          attached_by?: string | null
          detached_at?: string | null
          horse_id: string
          id?: string
          interval_weeks?: number | null
          role: Database["public"]["Enums"]["provider_role"]
          status?: Database["public"]["Enums"]["provider_status"]
          user_id: string
        }
        Update: {
          attached_at?: string
          attached_by?: string | null
          detached_at?: string | null
          horse_id?: string
          id?: string
          interval_weeks?: number | null
          role?: Database["public"]["Enums"]["provider_role"]
          status?: Database["public"]["Enums"]["provider_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "horse_providers_attached_by_fkey"
            columns: ["attached_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horse_providers_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horse_providers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      horses: {
        Row: {
          archived_at: string | null
          breed: string | null
          color: string | null
          created_at: string
          created_by: string | null
          discipline: string | null
          foaled_year: number | null
          id: string
          location_id: string | null
          name: string
          photo_path: string | null
          shoe_status: Database["public"]["Enums"]["shoe_status"] | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          breed?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          discipline?: string | null
          foaled_year?: number | null
          id?: string
          location_id?: string | null
          name: string
          photo_path?: string | null
          shoe_status?: Database["public"]["Enums"]["shoe_status"] | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          breed?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          discipline?: string | null
          foaled_year?: number | null
          id?: string
          location_id?: string | null
          name?: string
          photo_path?: string | null
          shoe_status?: Database["public"]["Enums"]["shoe_status"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "horses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horses_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          amount_cents: number | null
          description: string
          horse_id: string | null
          id: string
          invoice_id: string
          quantity: number
          sort_order: number
          taxable: boolean
          unit_price_cents: number
          visit_id: string | null
        }
        Insert: {
          amount_cents?: number | null
          description: string
          horse_id?: string | null
          id?: string
          invoice_id: string
          quantity?: number
          sort_order?: number
          taxable?: boolean
          unit_price_cents: number
          visit_id?: string | null
        }
        Update: {
          amount_cents?: number | null
          description?: string
          horse_id?: string | null
          id?: string
          invoice_id?: string
          quantity?: number
          sort_order?: number
          taxable?: boolean
          unit_price_cents?: number
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid_cents: number
          appointment_id: string | null
          client_id: string
          created_at: string
          currency: string
          due_date: string | null
          id: string
          invoice_number: number
          notes: string | null
          paid_at: string | null
          provider_id: string
          sent_at: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          stripe_payment_intent_id: string | null
          subtotal_cents: number
          tax_breakdown: Json
          tax_cents: number
          total_cents: number | null
          updated_at: string
        }
        Insert: {
          amount_paid_cents?: number
          appointment_id?: string | null
          client_id: string
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          invoice_number: number
          notes?: string | null
          paid_at?: string | null
          provider_id: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          stripe_payment_intent_id?: string | null
          subtotal_cents?: number
          tax_breakdown?: Json
          tax_cents?: number
          total_cents?: number | null
          updated_at?: string
        }
        Update: {
          amount_paid_cents?: number
          appointment_id?: string | null
          client_id?: string
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          invoice_number?: number
          notes?: string | null
          paid_at?: string | null
          provider_id?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          stripe_payment_intent_id?: string | null
          subtotal_cents?: number
          tax_breakdown?: Json
          tax_cents?: number
          total_cents?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          archived_at: string | null
          created_at: string
          created_by: string
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          archived_at?: string | null
          created_at?: string
          created_by: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          archived_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          appointment_id: string | null
          channel: string
          horse_id: string | null
          id: string
          invoice_id: string | null
          kind: string
          sent_at: string
          user_id: string
        }
        Insert: {
          appointment_id?: string | null
          channel: string
          horse_id?: string | null
          id?: string
          invoice_id?: string | null
          kind: string
          sent_at?: string
          user_id: string
        }
        Update: {
          appointment_id?: string | null
          channel?: string
          horse_id?: string | null
          id?: string
          invoice_id?: string | null
          kind?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      observations: {
        Row: {
          created_at: string
          horse_id: string
          id: string
          note: string
          photo_path: string | null
          shared_with_providers: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          horse_id: string
          id?: string
          note: string
          photo_path?: string | null
          shared_with_providers?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          horse_id?: string
          id?: string
          note?: string
          photo_path?: string | null
          shared_with_providers?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "observations_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          application_fee_cents: number | null
          created_at: string
          id: string
          invoice_id: string
          method: Database["public"]["Enums"]["payment_method"]
          paid_at: string
          recorded_by: string | null
          status: Database["public"]["Enums"]["payment_status"]
          stripe_charge_id: string | null
          stripe_payment_intent_id: string | null
        }
        Insert: {
          amount_cents: number
          application_fee_cents?: number | null
          created_at?: string
          id?: string
          invoice_id: string
          method: Database["public"]["Enums"]["payment_method"]
          paid_at?: string
          recorded_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
        }
        Update: {
          amount_cents?: number
          application_fee_cents?: number | null
          created_at?: string
          id?: string
          invoice_id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          paid_at?: string
          recorded_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          business_name: string | null
          country: string
          created_at: string
          default_currency: string
          distance_unit: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          region: string | null
          service_area: string | null
          stripe_account_id: string | null
          stripe_charges_enabled: boolean
          stripe_payouts_enabled: boolean
          timezone: string
          trip_fee_cents: number
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          business_name?: string | null
          country?: string
          created_at?: string
          default_currency?: string
          distance_unit?: string
          email?: string | null
          full_name?: string
          id: string
          phone?: string | null
          region?: string | null
          service_area?: string | null
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_payouts_enabled?: boolean
          timezone?: string
          trip_fee_cents?: number
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          business_name?: string | null
          country?: string
          created_at?: string
          default_currency?: string
          distance_unit?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          region?: string | null
          service_area?: string | null
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_payouts_enabled?: boolean
          timezone?: string
          trip_fee_cents?: number
          updated_at?: string
        }
        Relationships: []
      }
      provider_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          expires_at: string
          horse_id: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["provider_role"]
          sent_to: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          expires_at?: string
          horse_id: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["provider_role"]
          sent_to: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          expires_at?: string
          horse_id?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["provider_role"]
          sent_to?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_invites_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_invites_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_services: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          price_cents: number
          provider_id: string
          sort_order: number
          taxable: boolean
          updated_at: string
          work_type: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          price_cents: number
          provider_id: string
          sort_order?: number
          taxable?: boolean
          updated_at?: string
          work_type?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          price_cents?: number
          provider_id?: string
          sort_order?: number
          taxable?: boolean
          updated_at?: string
          work_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_services_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string
          id: string
          last_seen_at: string
          platform: Database["public"]["Enums"]["device_platform"]
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_seen_at?: string
          platform: Database["public"]["Enums"]["device_platform"]
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_seen_at?: string
          platform?: Database["public"]["Enums"]["device_platform"]
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_webhook_events: {
        Row: {
          id: string
          payload: Json
          processed_at: string
          type: string
        }
        Insert: {
          id: string
          payload: Json
          processed_at?: string
          type: string
        }
        Update: {
          id?: string
          payload?: Json
          processed_at?: string
          type?: string
        }
        Relationships: []
      }
      tax_rates: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          provider_id: string
          rate_bp: number
          sort_order: number
          tax_number: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          provider_id: string
          rate_bp: number
          sort_order?: number
          tax_number?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          provider_id?: string
          rate_bp?: number
          sort_order?: number
          tax_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_rates_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trim_cycle_estimates: {
        Row: {
          avg_interval_days: number | null
          basis_visit_count: number | null
          calculated_at: string
          horse_id: string
          seasonal_adjust: number | null
          suggested_next: string | null
        }
        Insert: {
          avg_interval_days?: number | null
          basis_visit_count?: number | null
          calculated_at?: string
          horse_id: string
          seasonal_adjust?: number | null
          suggested_next?: string | null
        }
        Update: {
          avg_interval_days?: number | null
          basis_visit_count?: number | null
          calculated_at?: string
          horse_id?: string
          seasonal_adjust?: number | null
          suggested_next?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trim_cycle_estimates_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: true
            referencedRelation: "horses"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_events: {
        Row: {
          created_at: string
          event_type: string
          horse_id: string | null
          id: string
          region: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          horse_id?: string | null
          id?: string
          region?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          horse_id?: string | null
          id?: string
          region?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_feet: {
        Row: {
          created_at: string
          findings: string | null
          foot: Database["public"]["Enums"]["foot_position"]
          modifications: string | null
          pads: string | null
          shoe_make: string | null
          shoe_model: string | null
          shoe_size: string | null
          studs: string | null
          updated_at: string
          visit_id: string
          work: string
        }
        Insert: {
          created_at?: string
          findings?: string | null
          foot: Database["public"]["Enums"]["foot_position"]
          modifications?: string | null
          pads?: string | null
          shoe_make?: string | null
          shoe_model?: string | null
          shoe_size?: string | null
          studs?: string | null
          updated_at?: string
          visit_id: string
          work: string
        }
        Update: {
          created_at?: string
          findings?: string | null
          foot?: Database["public"]["Enums"]["foot_position"]
          modifications?: string | null
          pads?: string | null
          shoe_make?: string | null
          shoe_model?: string | null
          shoe_size?: string | null
          studs?: string | null
          updated_at?: string
          visit_id?: string
          work?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_feet_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_flags: {
        Row: {
          flag_type: string
          id: string
          notes: string | null
          resolved_at: string | null
          visit_id: string
        }
        Insert: {
          flag_type: string
          id?: string
          notes?: string | null
          resolved_at?: string | null
          visit_id: string
        }
        Update: {
          flag_type?: string
          id?: string
          notes?: string | null
          resolved_at?: string | null
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_flags_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_photos: {
        Row: {
          angle: string | null
          created_at: string
          foot: Database["public"]["Enums"]["foot_position"] | null
          id: string
          label: string | null
          stage: string | null
          storage_path: string
          visit_id: string
        }
        Insert: {
          angle?: string | null
          created_at?: string
          foot?: Database["public"]["Enums"]["foot_position"] | null
          id?: string
          label?: string | null
          stage?: string | null
          storage_path: string
          visit_id: string
        }
        Update: {
          angle?: string | null
          created_at?: string
          foot?: Database["public"]["Enums"]["foot_position"] | null
          id?: string
          label?: string | null
          stage?: string | null
          storage_path?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_photos_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_requests: {
        Row: {
          created_at: string
          decline_reason: string | null
          horse_id: string
          id: string
          notes: string | null
          preferred_end: string | null
          preferred_start: string | null
          requested_by: string
          requested_provider_id: string
          responded_at: string | null
          status: Database["public"]["Enums"]["request_status"]
          urgency: Database["public"]["Enums"]["request_urgency"]
        }
        Insert: {
          created_at?: string
          decline_reason?: string | null
          horse_id: string
          id?: string
          notes?: string | null
          preferred_end?: string | null
          preferred_start?: string | null
          requested_by: string
          requested_provider_id: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          urgency?: Database["public"]["Enums"]["request_urgency"]
        }
        Update: {
          created_at?: string
          decline_reason?: string | null
          horse_id?: string
          id?: string
          notes?: string | null
          preferred_end?: string | null
          preferred_start?: string | null
          requested_by?: string
          requested_provider_id?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          urgency?: Database["public"]["Enums"]["request_urgency"]
        }
        Relationships: [
          {
            foreignKeyName: "visit_requests_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_requests_requested_provider_id_fkey"
            columns: ["requested_provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      visits: {
        Row: {
          appointment_id: string | null
          created_at: string
          ground_conditions: string | null
          horse_id: string
          id: string
          is_flagged: boolean
          next_due_date: string | null
          notes: string | null
          provider_id: string
          season: string | null
          shared_with_owner: boolean
          updated_at: string
          visit_date: string
          visit_type: Database["public"]["Enums"]["visit_type"]
          work_type: string | null
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          ground_conditions?: string | null
          horse_id: string
          id?: string
          is_flagged?: boolean
          next_due_date?: string | null
          notes?: string | null
          provider_id: string
          season?: string | null
          shared_with_owner?: boolean
          updated_at?: string
          visit_date: string
          visit_type: Database["public"]["Enums"]["visit_type"]
          work_type?: string | null
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          ground_conditions?: string | null
          horse_id?: string
          id?: string
          is_flagged?: boolean
          next_due_date?: string | null
          notes?: string | null
          provider_id?: string
          season?: string | null
          shared_with_owner?: boolean
          updated_at?: string
          visit_date?: string
          visit_type?: Database["public"]["Enums"]["visit_type"]
          work_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visits_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      due_horses: {
        Row: {
          horse_id: string | null
          horse_name: string | null
          interval_weeks: number | null
          last_visit: string | null
          location_id: string | null
          next_due: string | null
          provider_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "horse_providers_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horse_providers_user_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horses_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_client_invite: { Args: { p_token: string }; Returns: string }
      accept_provider_invite: { Args: { p_token: string }; Returns: string }
      active_provider_role: {
        Args: { h: string }
        Returns: Database["public"]["Enums"]["provider_role"][]
      }
      attach_provider: {
        Args: {
          p_horse: string
          p_role: Database["public"]["Enums"]["provider_role"]
          p_user: string
        }
        Returns: undefined
      }
      can_see_appointment: { Args: { a: string }; Returns: boolean }
      can_see_horse: { Args: { h: string }; Returns: boolean }
      can_see_invoice: { Args: { i: string }; Returns: boolean }
      cancel_visit_request: { Args: { p_request: string }; Returns: undefined }
      confirm_appointment: {
        Args: { p_appointment: string }
        Returns: undefined
      }
      create_horse_for_client: {
        Args: {
          p_client_id?: string
          p_location_id?: string
          p_name: string
          p_role?: Database["public"]["Enums"]["provider_role"]
        }
        Returns: string
      }
      create_own_horse: {
        Args: { p_location_id?: string; p_name: string }
        Returns: string
      }
      detach_provider: {
        Args: {
          p_horse: string
          p_role: Database["public"]["Enums"]["provider_role"]
          p_user: string
        }
        Returns: undefined
      }
      find_people: {
        Args: { p_query: string }
        Returns: {
          avatar_path: string
          business_name: string
          full_name: string
          id: string
          service_area: string
        }[]
      }
      is_active_provider: { Args: { h: string }; Returns: boolean }
      is_horse_owner: { Args: { h: string }; Returns: boolean }
      my_client_ids: { Args: never; Returns: string[] }
      provider_can_see_visit_type: {
        Args: { h: string; vt: Database["public"]["Enums"]["visit_type"] }
        Returns: boolean
      }
      respond_to_visit_request: {
        Args: {
          p_accept: boolean
          p_decline_reason?: string
          p_request: string
        }
        Returns: undefined
      }
      set_shoeing_interval: {
        Args: { p_horse: string; p_weeks: number }
        Returns: undefined
      }
      shares_connection: { Args: { p: string }; Returns: boolean }
    }
    Enums: {
      appointment_status: "scheduled" | "completed" | "cancelled" | "no_show"
      device_platform: "ios" | "android" | "web"
      foot_position: "LF" | "RF" | "LH" | "RH"
      invoice_status: "draft" | "sent" | "paid" | "partially_paid" | "void"
      payment_method: "card" | "cash" | "check" | "other"
      payment_status: "pending" | "succeeded" | "failed" | "refunded"
      permission_type:
        | "vet_sees_farrier_history"
        | "farrier_sees_vet_history"
        | "trainer_sees_farrier_history"
      provider_role: "farrier" | "vet" | "trainer"
      provider_status: "active" | "past"
      request_status: "pending" | "accepted" | "declined" | "cancelled"
      request_urgency: "routine" | "urgent"
      shoe_status: "barefoot" | "shod_front" | "shod_full" | "other"
      visit_type: "farrier" | "vet" | "trainer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      appointment_status: ["scheduled", "completed", "cancelled", "no_show"],
      device_platform: ["ios", "android", "web"],
      foot_position: ["LF", "RF", "LH", "RH"],
      invoice_status: ["draft", "sent", "paid", "partially_paid", "void"],
      payment_method: ["card", "cash", "check", "other"],
      payment_status: ["pending", "succeeded", "failed", "refunded"],
      permission_type: [
        "vet_sees_farrier_history",
        "farrier_sees_vet_history",
        "trainer_sees_farrier_history",
      ],
      provider_role: ["farrier", "vet", "trainer"],
      provider_status: ["active", "past"],
      request_status: ["pending", "accepted", "declined", "cancelled"],
      request_urgency: ["routine", "urgent"],
      shoe_status: ["barefoot", "shod_front", "shod_full", "other"],
      visit_type: ["farrier", "vet", "trainer"],
    },
  },
} as const
