export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string | null
          email: string
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username?: string | null
          email: string
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          username?: string | null
          email?: string
          avatar_url?: string | null
          updated_at?: string
        }
      }
      friendships: {
        Row: {
          id: string
          requester_id: string
          addressee_id: string
          status: 'pending' | 'accepted'
          created_at: string
        }
        Insert: {
          requester_id: string
          addressee_id: string
          status?: 'pending' | 'accepted'
        }
        Update: {
          status?: 'pending' | 'accepted'
        }
      }
      lists: {
        Row: {
          id: string
          owner_id: string
          name: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          owner_id: string
          name: string
          is_active?: boolean
        }
        Update: {
          name?: string
          is_active?: boolean
          updated_at?: string
        }
      }
      list_members: {
        Row: {
          list_id: string
          user_id: string
          role: 'owner' | 'member'
          joined_at: string
        }
        Insert: {
          list_id: string
          user_id: string
          role?: 'owner' | 'member'
        }
        Update: {
          role?: 'owner' | 'member'
        }
      }
      items: {
        Row: {
          id: string
          list_id: string
          added_by: string
          name: string
          quantity: number
          unit: string | null
          checked: boolean
          checked_by: string | null
          checked_at: string | null
          product_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          list_id: string
          added_by: string
          name: string
          quantity?: number
          unit?: string | null
          checked?: boolean
          product_id?: string | null
        }
        Update: {
          name?: string
          quantity?: number
          unit?: string | null
          checked?: boolean
          checked_by?: string | null
          checked_at?: string | null
          updated_at?: string
        }
      }
      products: {
        Row: {
          id: string
          name: string
          brand: string | null
          category: string | null
          barcode: string | null
          image_url: string | null
          created_at: string
        }
        Insert: {
          name: string
          brand?: string | null
          category?: string | null
          barcode?: string | null
          image_url?: string | null
        }
        Update: {
          name?: string
          brand?: string | null
          category?: string | null
        }
      }
      market_prices: {
        Row: {
          id: string
          product_id: string
          market_name: string
          price: number
          scraped_at: string
        }
        Insert: {
          product_id: string
          market_name: string
          price: number
        }
        Update: {
          price?: number
          scraped_at?: string
        }
      }
      purchase_history: {
        Row: {
          id: string
          list_id: string
          user_id: string
          total_spent: number | null
          receipt_url: string | null
          purchased_at: string
        }
        Insert: {
          list_id: string
          user_id: string
          total_spent?: number | null
          receipt_url?: string | null
        }
        Update: {
          total_spent?: number | null
          receipt_url?: string | null
        }
      }
      presence: {
        Row: {
          user_id: string
          last_seen: string
          status: 'online' | 'offline'
        }
        Insert: {
          user_id: string
          status?: 'online' | 'offline'
        }
        Update: {
          last_seen?: string
          status?: 'online' | 'offline'
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      friendship_status: 'pending' | 'accepted'
      member_role: 'owner' | 'member'
      user_status: 'online' | 'offline'
    }
  }
}
