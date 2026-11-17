export type UserRole = "admin" | "driver" | "passenger";

export type AccountStatus = "pending" | "active" | "suspended" | "revoked";

export type SubscriptionTier = "free" | "no_ads" | "premium";

export type LandmarkStatus = "pending" | "approved" | "rejected";

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

export type TripStatus =
  | "requested"
  | "accepted"
  | "arriving"
  | "in_progress"
  | "waiting"
  | "completed"
  | "cancelled";

export type AdActionType = "whatsapp" | "web";

export type Locality = {
  id: string;
  name: string;
  province: string;
  center_location: unknown;
  radius_km: number;
  is_active: boolean;
  created_at: string;
};

export type TaxiCompany = {
  id: string;
  locality_id: string;
  name: string;
  badge_color: string;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
};

export type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role: UserRole;
  account_status: AccountStatus;
  locality_id: string | null;
  avatar_url: string | null;
  subscription_tier: SubscriptionTier;
  subscription_expires_at: string | null;
  fcm_token: string | null;
  created_at: string;
  updated_at: string;
};

export type DriverDetails = {
  user_id: string;
  company_id: string | null;
  car_brand: string | null;
  car_model: string | null;
  car_color: string | null;
  plate_number: string | null;
  car_photo_url: string | null;
  selfie_url: string | null;
  license_front_url: string | null;
  license_back_url: string | null;
  municipal_permit_url: string | null;
  permit_expiry_date: string | null;
  is_online: boolean;
  current_location: unknown;
  last_location_at: string | null;
  rating_avg: number | null;
  total_trips: number;
  updated_at: string;
};

export type DriverWithProfile = DriverDetails & {
  profile: Profile | null;
  company: TaxiCompany | null;
  locality: Locality | null;
};

export type Landmark = {
  id: string;
  locality_id: string;
  name: string;
  category: string | null;
  location: unknown;
  is_public: boolean;
  status: LandmarkStatus;
  created_by: string | null;
  created_at: string;
};

export type SupportTicket = {
  id: string;
  user_id: string;
  trip_id: string | null;
  locality_id: string | null;
  category: string | null;
  description: string | null;
  is_emergency: boolean;
  status: TicketStatus;
  created_at: string;
};

export type Trip = {
  id: string;
  passenger_id: string;
  driver_id: string | null;
  locality_id: string | null;
  status: TripStatus;
  origin_address: string | null;
  origin_point: unknown;
  dest_address: string | null;
  dest_point: unknown;
  is_round_trip: boolean;
  scheduled_for: string | null;
  cancel_reason: string | null;
  cancelled_by: string | null;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export type Rating = {
  id: string;
  trip_id: string;
  passenger_id: string;
  driver_id: string;
  stars: number;
  comment: string | null;
  created_at: string;
};

export type AdBanner = {
  id: string;
  locality_id: string;
  business_name: string;
  image_url: string;
  action_type: AdActionType;
  action_target: string;
  start_date: string;
  end_date: string;
  is_paid: boolean;
  is_active: boolean;
  clicks_count: number;
  created_at: string;
};

type TableEntry<
  Row extends Record<string, unknown>,
  Insert extends Record<string, unknown> = Partial<Row>,
  Update extends Record<string, unknown> = Partial<Row>,
> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type TaxiyaDatabase = {
  taxiya: {
    Tables: {
      localities: TableEntry<Locality>;
      taxi_companies: TableEntry<TaxiCompany>;
      profiles: TableEntry<Profile>;
      driver_details: TableEntry<DriverDetails>;
      landmarks: TableEntry<Landmark>;
      support_tickets: TableEntry<SupportTicket>;
      trips: TableEntry<Trip>;
      ratings: TableEntry<Rating>;
      ad_banners: TableEntry<AdBanner>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
