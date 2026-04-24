/**
 * Fluxo de viagem do motorista — alinhado a `Zamba-Motorista-/src/types.ts` e overlays web.
 */

import type { VehicleCategory } from '@/types/driver';

export type RideFlowStatus =
  | 'searching'
  | 'accepted'
  | 'arriving'
  | 'arrived'
  | 'ontrip'
  | 'completed'
  | 'cancelled'
  | 'offered'
  | 'completed_by_driver'
  | 'cancelled_by_driver';

/** Oferta para UI (modal «Nova corrida»). */
export interface ActiveOfferUI {
  id: string;
  rideId: string;
  passengerName: string;
  passengerPhone: string | null;
  passengerAvatar: string | null;
  origin: string;
  destination: string;
  vehicleCategory: string;
  offeredAt: string;
  expiresAt: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  pickup_lat: number;
  pickup_lng: number;
}

export interface RidePassengerContact {
  id: string;
  /** auth.users.id do passageiro (RPC pode expor como user_id / passenger_user_id). */
  user_id?: string;
  full_name: string;
  phone: string;
  avatar_url?: string | null;
}

/** Linha `rides` + passageiro (como `getRideDetails` / `getActiveRide` no web). */
export interface DriverActiveRideDetails {
  id: string;
  /** auth.users.id do passageiro (para RPCs que exigem user_id). */
  passenger_user_id?: string | null;
  passenger_id?: string | null;
  driver_id?: string | null;
  pickup_lat: number;
  pickup_lng: number;
  pickup_address: string;
  destination_lat: number;
  destination_lng: number;
  dropoff_address: string;
  status: RideFlowStatus;
  vehicle_category: VehicleCategory;
  pricing_category?: VehicleCategory;
  fare_estimate?: number | null;
  estimated_fare?: number | null;
  price_estimate?: number | null;
  final_fare?: number | null;
  fare_final?: number | null;
  extra_fare?: number | null;
  extra_distance_km?: number | null;
  extra_duration_min?: number | null;
  actual_distance_km?: number | null;
  actual_duration_min?: number | null;
  applied_base_fare?: number | null;
  applied_price_per_km?: number | null;
  applied_price_per_minute?: number | null;
  applied_minimum_fare?: number | null;
  created_at: string;
  updated_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  passenger?: RidePassengerContact | null;
}

export interface RideLiveRouteRow {
  ride_id: string;
  polyline: string;
  distance_meters: number;
  duration_seconds: number;
  route_phase: string;
  updated_at: string;
}
