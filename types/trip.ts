/** Alinhado a `driverService.getTripDetails` / `History.tsx` (web). */

export type TripPeriod = 'today' | 'week' | 'month';

export type DriverStatsSummary = {
  today_earnings: number;
  today_trips: number;
  week_earnings: number;
  week_trips: number;
  month_earnings: number;
  month_trips: number;
};

export type TripPassenger = {
  full_name?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
};

/** Linha devolvida por RPC `get_driver_trips_by_period` (lista na History web). */
export type DriverTripListRow = {
  id: string;
  pickup_address?: string | null;
  dropoff_address?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
  final_fare?: number | null;
  price_estimate?: number | null;
  status?: string | null;
};

/** Resultado de `getTripDetails` — join `profiles!passenger_id`. */
export type TripDetails = {
  id: string;
  pickup_address: string;
  dropoff_address: string;
  created_at: string;
  completed_at?: string | null;
  final_fare?: number | null;
  price_estimate?: number | null;
  status?: string | null;
  driver_id?: string | null;
  passenger?: TripPassenger | TripPassenger[] | null;
};
