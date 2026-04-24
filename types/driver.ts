/**
 * Tipos alinhados a `Zamba-Motorista-/src/types.ts` (campos usados no painel inicial).
 */
export type VerificationStatus =
  | 'pending_documents'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'pending'
  | 'verified';

export type AccountStatus = 'active' | 'inactive' | 'suspended' | 'incomplete';

export type VehicleCategory = 'economico' | 'conforto' | 'moto' | 'txopela';

/** `DocType` em `Zamba-Motorista-/src/types.ts` — documentos na ativação. */
export type DriverDocType = 'license' | 'livrete' | 'vehicle_front' | 'vehicle_back' | 'driver_selfie';

export interface DriverProfile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  vehicle_type?: string;
  vehicle_brand?: string;
  vehicle_model?: string;
  vehicle_color?: string;
  plate?: string;
  vehicle_category?: VehicleCategory;
  verification_status: VerificationStatus;
  approval_status?: VerificationStatus;
  account_status?: AccountStatus;
  is_blocked?: boolean;
  rejection_reason?: string;
  is_online: boolean;
  is_busy: boolean;
  created_at: string;
  updated_at?: string;
  notifications_enabled?: boolean;
  notification_sound?: string;
  map_type?: 'normal' | 'satellite';
  map_3d?: boolean;
  theme?: 'light' | 'dark';
}

export interface DriverWallet {
  driver_id: string;
  balance: number;
  min_required_balance: number;
  updated_at: string;
}

/** `Zamba-Motorista-/src/types.ts` — `DriverTopup`. */
export interface DriverTopup {
  id: string;
  driver_id: string;
  method: 'mpesa' | 'emola';
  amount: number;
  reference?: string;
  proof_url?: string;
  observation?: string;
  status: 'pending' | 'approved' | 'rejected' | 'paid' | 'failed';
  created_at: string;
}

/** Linhas de `wallet_transactions` (comissões por viagem), como no web `Wallet.tsx`. */
export interface WalletCommissionTransaction {
  id: string;
  ride_id: string | null;
  transaction_type: string;
  direction: string;
  amount: number;
  balance_before: number | null;
  balance_after: number | null;
  description: string | null;
  created_at: string;
}

/** `Zamba-Motorista-/src/types.ts` — caminhos em `driver_documents`. */
export interface DriverDocument {
  license: string | null;
  livrete: string | null;
  vehicle_front: string | null;
  vehicle_back: string | null;
  driver_selfie: string | null;
}

/** Igual ao web `MIN_BALANCE`. */
export const MIN_BALANCE = 10;
