import { File as FsFile } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import { supabase } from '@/lib/supabase';
import { recalculateRoute, syncLiveRouteFromServer } from '@/services/routeService';
import type { ActiveOfferUI, DriverActiveRideDetails } from '@/types/rideFlow';
import type {
  DriverDocType,
  DriverDocument,
  DriverProfile,
  DriverTopup,
  DriverWallet,
  WalletCommissionTransaction,
} from '@/types/driver';
import { MIN_BALANCE } from '@/types/driver';
import type {
  DriverStatsSummary,
  DriverTripListRow,
  TripDetails,
  TripPeriod,
} from '@/types/trip';

/** Metadados opcionais do `expo-image-picker` — alinham extensão e `contentType` ao web (`AccountActivation.tsx`). */
export type DriverDocUploadAsset = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
};

function normalizeFileExt(raw: string | undefined | null): 'jpg' | 'png' | 'webp' | null {
  if (!raw) return null;
  const e = raw.toLowerCase().replace(/^\./, '');
  if (e === 'jpeg' || e === 'jpg') return 'jpg';
  if (e === 'png') return 'png';
  if (e === 'webp') return 'webp';
  return null;
}

function extAndContentTypeFromAsset(asset: DriverDocUploadAsset): { ext: string; contentType: string } {
  const fromName = normalizeFileExt(asset.fileName?.split('.').pop());
  if (fromName === 'png') return { ext: 'png', contentType: 'image/png' };
  if (fromName === 'webp') return { ext: 'webp', contentType: 'image/webp' };
  if (fromName === 'jpg') return { ext: 'jpg', contentType: 'image/jpeg' };

  const mt = (asset.mimeType || '').toLowerCase();
  if (mt.includes('png')) return { ext: 'png', contentType: 'image/png' };
  if (mt.includes('webp')) return { ext: 'webp', contentType: 'image/webp' };
  return { ext: 'jpg', contentType: 'image/jpeg' };
}

async function readUriAsUint8Array(uri: string): Promise<Uint8Array> {
  const file = new FsFile(uri);
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}

/** Redimensiona/comprime como no web (~1600px, qualidade ~0.8); se falhar, usa o ficheiro original. */
async function prepareDriverDocUploadBytes(
  asset: DriverDocUploadAsset,
): Promise<{ bytes: Uint8Array; ext: string; contentType: string }> {
  try {
    const manipulated = await manipulateAsync(
      asset.uri,
      [{ resize: { width: 1600 } }],
      { compress: 0.8, format: SaveFormat.JPEG },
    );
    const bytes = await readUriAsUint8Array(manipulated.uri);
    return { bytes, ext: 'jpg', contentType: 'image/jpeg' };
  } catch (err) {
    if (__DEV__) console.warn('[driverService] prepareDriverDocUploadBytes: compress fallback', err);
    const { ext, contentType } = extAndContentTypeFromAsset(asset);
    const bytes = await readUriAsUint8Array(asset.uri);
    return { bytes, ext, contentType };
  }
}

export const driverService = {
  async getDriverId(userId: string): Promise<string | null> {
    const { data, error } = await supabase.from('drivers').select('id').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return data?.id || null;
  },

  async getProfile(userId: string): Promise<DriverProfile | null> {
    const { data, error } = await supabase.from('drivers').select('*').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return data as DriverProfile | null;
  },

  /**
   * `driver_documents` — suporta o modelo da página web `AccountActivation.tsx`
   * (`license_path`, `driver_photo_path`, …) e o modelo legado (`document_type` + `file_path`).
   */
  async getDocuments(userId: string, providedDriverId?: string): Promise<DriverDocument | null> {
    const driverId = providedDriverId || (await this.getDriverId(userId));
    if (!driverId) return null;

    const { data, error } = await supabase.from('driver_documents').select('*').eq('driver_id', driverId);

    if (error) {
      if (error.code === '42P01') throw error;
      return null;
    }

    const empty: DriverDocument = {
      license: null,
      livrete: null,
      vehicle_front: null,
      vehicle_back: null,
      driver_selfie: null,
    };

    if (!data?.length) return empty;

    const wide = data.find(
      (row: Record<string, unknown>) =>
        row.license_path != null ||
        row.driver_photo_path != null ||
        row.vehicle_front_path != null ||
        row.vehicle_registration_path != null ||
        row.vehicle_rear_path != null,
    ) as Record<string, unknown> | undefined;

    if (wide) {
      return {
        license: (wide.license_path as string | null | undefined) ?? null,
        livrete: (wide.vehicle_registration_path as string | null | undefined) ?? null,
        vehicle_front: (wide.vehicle_front_path as string | null | undefined) ?? null,
        vehicle_back: (wide.vehicle_rear_path as string | null | undefined) ?? null,
        driver_selfie: (wide.driver_photo_path as string | null | undefined) ?? null,
      };
    }

    const result = { ...empty };
    data.forEach((doc: { document_type?: string; file_path?: string | null }) => {
      if (doc.document_type === 'license') result.license = doc.file_path ?? null;
      if (doc.document_type === 'livrete') result.livrete = doc.file_path ?? null;
      if (doc.document_type === 'vehicle_front') result.vehicle_front = doc.file_path ?? null;
      if (doc.document_type === 'vehicle_back') result.vehicle_back = doc.file_path ?? null;
      if (doc.document_type === 'driver_selfie') result.driver_selfie = doc.file_path ?? null;
    });
    return result;
  },

  /** `profiles` — `avatar_url` / `selfie_url` (colunas opcionais conforme schema). */
  async getProfileAvatars(userId: string): Promise<{ avatar_url: string | null; selfie_url: string | null }> {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error || !data) {
      return { avatar_url: null, selfie_url: null };
    }
    const row = data as Record<string, unknown>;
    return {
      avatar_url: (row.avatar_url as string) ?? null,
      selfie_url: (row.selfie_url as string | undefined) ?? null,
    };
  },

  /** `Zamba-Motorista-/src/services/driverService.ts` — `update`. */
  async updateProfile(userId: string, updates: Partial<DriverProfile>) {
    const { data: existing, error: fetchError } = await supabase
      .from('drivers')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError) throw fetchError;

    const payload = { ...updates, updated_at: new Date().toISOString() };

    if (existing) {
      const { error: updateError } = await supabase.from('drivers').update(payload).eq('user_id', userId);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase.from('drivers').insert({
        user_id: userId,
        ...payload,
      });
      if (insertError) throw insertError;
    }
  },

  /**
   * Upload para `documentos_do_motorista` + atualização de `driver_documents` — espelha `AccountActivation.tsx` (web).
   */
  async uploadDriverDocumentFromUri(userId: string, driverId: string, type: DriverDocType, asset: DriverDocUploadAsset) {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session?.user?.id) {
      throw new Error('Sessão expirada. Inicie sessão novamente.');
    }
    if (session.user.id !== userId) {
      throw new Error('Sessão inválida para este utilizador.');
    }

    const nameMapping: Record<DriverDocType, string> = {
      license: 'carta_conducao',
      livrete: 'livrete',
      vehicle_front: 'veiculo_frontal',
      vehicle_back: 'veiculo_traseiro',
      driver_selfie: 'foto_motorista',
    };
    const columnMapping: Record<DriverDocType, string> = {
      license: 'license_path',
      livrete: 'vehicle_registration_path',
      vehicle_front: 'vehicle_front_path',
      vehicle_back: 'vehicle_rear_path',
      driver_selfie: 'driver_photo_path',
    };

    const baseName = nameMapping[type];
    const { bytes, ext: fileExt, contentType } = await prepareDriverDocUploadBytes(asset);
    const storagePath = `${userId}/${baseName}.${fileExt}`;
    const bucketName = 'documentos_do_motorista';

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(storagePath, bytes, {
        upsert: true,
        contentType,
      });

    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucketName).getPublicUrl(storagePath);

    const columnToUpdate = columnMapping[type];

    const { data: existingDoc, error: fetchDocError } = await supabase
      .from('driver_documents')
      .select('*')
      .eq('driver_id', driverId)
      .maybeSingle();

    if (fetchDocError) throw fetchDocError;

    if (existingDoc) {
      const { error: updateError } = await supabase
        .from('driver_documents')
        .update({
          [columnToUpdate]: publicUrl,
          status: 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', (existingDoc as { id: string }).id);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase.from('driver_documents').insert({
        driver_id: driverId,
        [columnToUpdate]: publicUrl,
        status: 'pending',
      });
      if (insertError) throw insertError;
    }

    return `${publicUrl}?t=${Date.now()}`;
  },

  async getWallet(userId: string): Promise<DriverWallet | null> {
    const driverId = await this.getDriverId(userId);
    if (!driverId) return null;

    const { data, error } = await supabase.from('driver_wallets').select('*').eq('driver_id', driverId).maybeSingle();
    if (error) throw error;

    if (!data) {
      const { data: newWallet, error: createError } = await supabase
        .from('driver_wallets')
        .insert({ driver_id: driverId, balance: 0, min_required_balance: 10 })
        .select()
        .single();
      if (createError) throw createError;
      return newWallet as DriverWallet;
    }
    return data as DriverWallet;
  },

  /** `Zamba-Motorista-/src/services/driverService.ts` — tabela `wallet_topup_requests`. */
  async getTopups(userId: string): Promise<DriverTopup[]> {
    const driverId = await this.getDriverId(userId);
    if (!driverId) return [];

    const { data, error } = await supabase
      .from('wallet_topup_requests')
      .select('*')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false });

    if (error) {
      return [];
    }

    return (data ?? []).map((item: Record<string, unknown>) => ({
      id: item.id as string,
      driver_id: item.driver_id as string,
      method: item.payment_method as 'mpesa' | 'emola',
      amount: Number(item.amount),
      reference: item.payment_reference as string | undefined,
      status: item.status as DriverTopup['status'],
      created_at: item.created_at as string,
      observation: item.notes as string | undefined,
      proof_url: item.proof_url as string | undefined,
    }));
  },

  /** RPC `request_wallet_topup` — igual ao web. */
  async createTopup(
    _userId: string,
    method: 'mpesa' | 'emola',
    amount: number,
    reference?: string,
    observation?: string,
  ) {
    const { error } = await supabase.rpc('request_wallet_topup', {
      p_amount: amount,
      p_payment_method: method,
      p_payment_reference: reference || null,
      p_notes: observation || null,
      p_proof_url: null,
      p_payer_name: null,
      p_payer_phone: null,
      p_proof_text: null,
    });

    if (error) throw error;
  },

  /** `wallet_transactions` — débitos `ride_commission`, como no web. */
  async getWalletTransactions(userId: string): Promise<WalletCommissionTransaction[]> {
    const currentDriverId = await this.getDriverId(userId);
    if (!currentDriverId) return [];

    const { data, error } = await supabase
      .from('wallet_transactions')
      .select(
        'id, ride_id, transaction_type, direction, amount, balance_before, balance_after, description, created_at',
      )
      .eq('driver_id', currentDriverId)
      .eq('direction', 'debit')
      .eq('transaction_type', 'ride_commission')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    return (data ?? []) as WalletCommissionTransaction[];
  },

  /** Tabela `commission_settings` — taxa ativa convertida para percentagem. */
  async getCurrentDiscountRate(): Promise<number> {
    const { data, error } = await supabase
      .from('commission_settings')
      .select('id, commission_rate, is_active, created_at, updated_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error('Não foi possível carregar a taxa atual');
    }

    if (data && data.commission_rate != null) {
      return Number((Number(data.commission_rate) * 100).toFixed(2));
    }

    return 10;
  },

  async getActiveRide(driverId: string, userId: string): Promise<{ id: string; status?: string } | null> {
    let { data, error } = await supabase
      .from('rides')
      .select('id, status')
      .eq('driver_id', driverId)
      .in('status', ['accepted', 'arriving', 'arrived', 'ontrip'])
      .maybeSingle();

    if (!data && !error) {
      const result = await supabase
        .from('rides')
        .select('id, status')
        .eq('driver_id', userId)
        .in('status', ['accepted', 'arriving', 'arrived', 'ontrip'])
        .maybeSingle();
      data = result.data;
      error = result.error;
    }

    if (error) throw error;
    return data as { id: string; status?: string } | null;
  },

  async setOnlineStatus(userId: string, isOnline: boolean) {
    const { error } = await supabase.from('drivers').update({ is_online: isOnline }).eq('user_id', userId);
    if (error) throw error;
  },

  async setBusyStatus(userId: string, isBusy: boolean) {
    const { error } = await supabase.from('drivers').update({ is_busy: isBusy }).eq('user_id', userId);
    if (error) throw error;
  },

  async updateCurrentLocation(userId: string, lat: number, lng: number) {
    const { error } = await supabase.rpc('update_driver_location', {
      p_lat: lat,
      p_lng: lng,
    });

    if (error) {
      const { data: driverData, error: driverError } = await supabase
        .from('drivers')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (driverError || !driverData) throw driverError || new Error('Motorista não encontrado');

      const realDriverId = driverData.id;
      const { error: upsertError } = await supabase
        .from('driver_locations_current')
        .upsert(
          {
            driver_id: realDriverId,
            lat,
            lng,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'driver_id' },
        )
        .select();

      if (upsertError) throw upsertError;
    }
  },

  /** `Zamba-Motorista-/src/services/driverService.ts` — RPC `get_driver_earnings_summary`. */
  async getDriverStats(userId: string): Promise<DriverStatsSummary> {
    const currentDriverId = await driverService.getDriverId(userId);
    if (!currentDriverId) {
      return {
        today_earnings: 0,
        today_trips: 0,
        week_earnings: 0,
        week_trips: 0,
        month_earnings: 0,
        month_trips: 0,
      };
    }

    const { data, error } = await supabase.rpc('get_driver_earnings_summary', {
      p_driver_id: currentDriverId,
    });

    if (error) throw error;

    const summary = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;

    return {
      today_earnings: Number(summary?.today_earnings ?? 0),
      today_trips: Number(summary?.today_trips ?? 0),
      week_earnings: Number(summary?.week_earnings ?? 0),
      week_trips: Number(summary?.week_trips ?? 0),
      month_earnings: Number(summary?.month_earnings ?? 0),
      month_trips: Number(summary?.month_trips ?? 0),
    };
  },

  /** RPC `get_driver_trips_by_period`. */
  async getDriverTrips(userId: string, period: TripPeriod = 'today'): Promise<DriverTripListRow[]> {
    const currentDriverId = await driverService.getDriverId(userId);
    if (!currentDriverId) return [];

    const { data, error } = await supabase.rpc('get_driver_trips_by_period', {
      p_driver_id: currentDriverId,
      p_period: period,
    });

    if (error) throw error;

    return (data ?? []) as DriverTripListRow[];
  },

  /** Mesmo `select` que em `History` / `driverService.getTripDetails` (web). */
  async getTripDetails(userId: string, tripId: string): Promise<TripDetails> {
    const currentDriverId = await driverService.getDriverId(userId);
    if (!currentDriverId) throw new Error('Driver not found');

    const { data, error } = await supabase
      .from('rides')
      .select(
        `
        id,
        pickup_address,
        dropoff_address,
        created_at,
        completed_at,
        final_fare,
        price_estimate,
        status,
        driver_id,
        passenger:profiles!passenger_id(
          full_name,
          phone,
          avatar_url
        )
      `,
      )
      .eq('id', tripId)
      .eq('driver_id', currentDriverId)
      .single();

    if (error) throw error;

    const row = data as TripDetails;
    if (Array.isArray(row.passenger)) {
      row.passenger = row.passenger[0] ?? null;
    }
    return row;
  },

  /**
   * `Zamba-Motorista-/src/services/driverService.ts` — `getRideDetails` (ecrã ativo).
   * Passageiro via RPC `get_ride_passenger_contact` (RLS).
   */
  async getRideDetails(rideId: string): Promise<DriverActiveRideDetails | null> {
    const uuid =
      typeof rideId === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rideId);
    if (!uuid) {
      throw new Error(`Invalid rideId UUID: ${rideId}`);
    }

    const { data, error } = await supabase
      .from('rides')
      .select(
        '*, price_estimate, estimated_fare, fare_estimate, final_fare, fare_final, extra_fare, extra_distance_km, extra_duration_min, applied_base_fare, applied_price_per_km, applied_price_per_minute, applied_minimum_fare',
      )
      .eq('id', rideId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const row = data as DriverActiveRideDetails;

    const { data: passengerData, error: rpcError } = await supabase.rpc('get_ride_passenger_contact', {
      p_ride_id: rideId,
    });

    if (rpcError) {
      const { data: fallbackData } = await supabase
        .from('rides')
        .select('passenger:profiles!passenger_id(id, full_name, phone, avatar_url)')
        .eq('id', rideId)
        .maybeSingle();
      const p = (fallbackData as { passenger?: unknown } | null)?.passenger;
      row.passenger = (Array.isArray(p) ? p[0] : p) as DriverActiveRideDetails['passenger'];
      if (row.passenger?.id) {
        row.passenger_user_id = row.passenger.id;
      } else if (row.passenger_id) {
        row.passenger_user_id = row.passenger_id;
      }
    } else if (passengerData && Array.isArray(passengerData) && passengerData.length > 0) {
      const r = passengerData[0] as Record<string, unknown>;
      const authUid =
        r.user_id ?? r.passenger_user_id ?? r.auth_user_id ?? r.passageiro_user_id ?? r.passenger_id;
      const uid = typeof authUid === 'string' && authUid ? authUid : '';
      row.passenger_user_id = uid || null;
      row.passenger = {
        id: String(r.passenger_id ?? uid ?? ''),
        user_id: uid || undefined,
        full_name: String(r.full_name ?? ''),
        phone: String(r.phone ?? ''),
        avatar_url: (r.avatar_url as string | null | undefined) ?? null,
      };
    } else {
      row.passenger = null;
    }

    if (!row.passenger_user_id && row.passenger_id) {
      row.passenger_user_id = row.passenger_id;
    }

    return row;
  },

  /**
   * Corrida ativa com detalhes completos — espelha `getActiveRide` do web (passageiro incluído).
   */
  async getActiveRideFull(driverId: string, userId: string): Promise<DriverActiveRideDetails | null> {
    let { data, error } = await supabase
      .from('rides')
      .select(
        '*, price_estimate, estimated_fare, fare_estimate, final_fare, fare_final, extra_fare, extra_distance_km, extra_duration_min, applied_base_fare, applied_price_per_km, applied_price_per_minute, applied_minimum_fare',
      )
      .eq('driver_id', driverId)
      .in('status', ['accepted', 'arriving', 'arrived', 'ontrip'])
      .maybeSingle();

    if (!data && !error) {
      const result = await supabase
        .from('rides')
        .select(
          '*, price_estimate, estimated_fare, fare_estimate, final_fare, fare_final, extra_fare, extra_distance_km, extra_duration_min, applied_base_fare, applied_price_per_km, applied_price_per_minute, applied_minimum_fare',
        )
        .eq('driver_id', userId)
        .in('status', ['accepted', 'arriving', 'arrived', 'ontrip'])
        .maybeSingle();
      data = result.data;
      error = result.error;
    }

    if (error) throw error;
    if (!data) return null;

    const row = data as DriverActiveRideDetails;
    const { data: passengerData, error: rpcError } = await supabase.rpc('get_ride_passenger_contact', {
      p_ride_id: data.id,
    });

    if (rpcError) {
      const { data: fallbackData } = await supabase
        .from('rides')
        .select('passenger:profiles!passenger_id(id, full_name, phone, avatar_url)')
        .eq('id', data.id)
        .maybeSingle();
      const p = (fallbackData as { passenger?: unknown } | null)?.passenger;
      row.passenger = (Array.isArray(p) ? p[0] : p) as DriverActiveRideDetails['passenger'];
      if (row.passenger?.id) {
        row.passenger_user_id = row.passenger.id;
      } else if (row.passenger_id) {
        row.passenger_user_id = row.passenger_id;
      }
    } else if (passengerData && Array.isArray(passengerData) && passengerData.length > 0) {
      const r = passengerData[0] as Record<string, unknown>;
      const authUid =
        r.user_id ?? r.passenger_user_id ?? r.auth_user_id ?? r.passageiro_user_id ?? r.passenger_id;
      const uid = typeof authUid === 'string' && authUid ? authUid : '';
      row.passenger_user_id = uid || null;
      row.passenger = {
        id: String(r.passenger_id ?? uid ?? ''),
        user_id: uid || undefined,
        full_name: String(r.full_name ?? ''),
        phone: String(r.phone ?? ''),
        avatar_url: (r.avatar_url as string | null | undefined) ?? null,
      };
    } else {
      row.passenger = null;
    }

    if (!row.passenger_user_id && row.passenger_id) {
      row.passenger_user_id = row.passenger_id;
    }

    return row;
  },

  /** `ride_offers` + `rides(*)` — como no web `getPendingOffer`. */
  async getPendingOffer(driverId: string): Promise<{ offer: Record<string, unknown>; ride: Record<string, unknown> } | null> {
    const { data, error } = await supabase
      .from('ride_offers')
      .select('*, rides(*)')
      .eq('driver_id', driverId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return null;
    if (!data) return null;

    const offer = data as Record<string, unknown>;
    const rides = offer.rides as Record<string, unknown> | undefined;
    return { offer, ride: rides ?? {} };
  },

  /**
   * Define `alert_triggered = true` apenas quando ainda é false ou null.
   * Retorna true se esta instância ganhou o “lock” (pode disparar som/notificação uma vez).
   */
  async claimOfferAlert(offerId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('ride_offers')
      .update({ alert_triggered: true })
      .eq('id', offerId)
      .or('alert_triggered.is.null,alert_triggered.eq.false')
      .select('id')
      .maybeSingle();

    if (error) {
      if (__DEV__) console.warn('[driverService] claimOfferAlert', error);
      return false;
    }
    return !!data;
  },

  /**
   * Oferta a partir do evento realtime (sem rede) — para mostrar o modal de imediato.
   * `rides` pode vir no payload se a subscrição incluir join; caso contrário endereços ficam vazios até `hydrateOfferForUi`.
   */
  buildMinimalOfferUiFromRow(offerRow: Record<string, unknown>): ActiveOfferUI | null {
    const offerId = String(offerRow.id ?? '');
    const rideId = String(offerRow.ride_id ?? '');
    if (!offerId || !rideId) return null;
    const rideData = (offerRow.rides as Record<string, unknown> | undefined) ?? {};
    const offeredAt = (offerRow.offered_at as string) || (offerRow.created_at as string);
    const expiresAt =
      (offerRow.expires_at as string) || new Date(Date.now() + 30000).toISOString();
    const status = (offerRow.status as ActiveOfferUI['status']) || 'pending';
    return {
      id: offerId,
      rideId,
      passengerName: 'Cliente',
      passengerPhone: null,
      passengerAvatar: null,
      origin: String(rideData.pickup_address ?? ''),
      destination: String(rideData.dropoff_address ?? ''),
      vehicleCategory: String(rideData.vehicle_category ?? rideData.pricing_category ?? 'economico'),
      offeredAt,
      expiresAt,
      status,
      pickup_lat: Number(rideData.pickup_lat ?? 0),
      pickup_lng: Number(rideData.pickup_lng ?? 0),
    };
  },

  /**
   * Mesma ideia que `buildMinimalOfferUiFromRow`, mas com `rides` já carregado (`getPendingOffer`).
   */
  syncOfferUiFromOfferAndRide(
    offerRow: Record<string, unknown>,
    rideData: Record<string, unknown>,
  ): ActiveOfferUI | null {
    const offerId = String(offerRow.id ?? '');
    const rideId = String(offerRow.ride_id ?? '');
    if (!offerId || !rideId) return null;
    const offeredAt = (offerRow.offered_at as string) || (offerRow.created_at as string);
    const expiresAt =
      (offerRow.expires_at as string) || new Date(Date.now() + 30000).toISOString();
    const status = (offerRow.status as ActiveOfferUI['status']) || 'pending';
    return {
      id: offerId,
      rideId,
      passengerName: 'Cliente',
      passengerPhone: null,
      passengerAvatar: null,
      origin: String(rideData.pickup_address ?? ''),
      destination: String(rideData.dropoff_address ?? ''),
      vehicleCategory: String(rideData.vehicle_category ?? rideData.pricing_category ?? 'economico'),
      offeredAt,
      expiresAt,
      status,
      pickup_lat: Number(rideData.pickup_lat ?? 0),
      pickup_lng: Number(rideData.pickup_lng ?? 0),
    };
  },

  /** Monta UI da oferta (mesmos campos que `rideDriverDebugService.handleIncomingOffer`). */
  async hydrateOfferForUi(
    offerRow: Record<string, unknown>,
    rideHint?: Record<string, unknown> | null,
  ): Promise<ActiveOfferUI | null> {
    const offerId = String(offerRow.id ?? '');
    const rideId = String(offerRow.ride_id ?? '');
    if (!offerId || !rideId) return null;

    let rideData: Record<string, unknown> = rideHint ?? (offerRow.rides as Record<string, unknown>) ?? {};

    if (!rideData.pickup_address) {
      const { data: ride } = await supabase.from('rides').select('*').eq('id', rideId).maybeSingle();
      if (ride) rideData = ride as Record<string, unknown>;
    }

    const { data: passengerData } = await supabase.rpc('get_ride_passenger_contact', { p_ride_id: rideId });

    let passenger: DriverActiveRideDetails['passenger'] = null;
    if (passengerData && Array.isArray(passengerData) && passengerData.length > 0) {
      const r = passengerData[0] as Record<string, unknown>;
      passenger = {
        id: String(r.passenger_id ?? ''),
        full_name: String(r.full_name ?? ''),
        phone: String(r.phone ?? ''),
        avatar_url: (r.avatar_url as string | null | undefined) ?? null,
      };
    } else {
      const { data: fallbackData } = await supabase
        .from('rides')
        .select('passenger:profiles!passenger_id(id, full_name, phone, avatar_url)')
        .eq('id', rideId)
        .maybeSingle();
      const p = (fallbackData as { passenger?: unknown } | null)?.passenger;
      passenger = (Array.isArray(p) ? p[0] : p) as DriverActiveRideDetails['passenger'];
    }

    const offeredAt = (offerRow.offered_at as string) || (offerRow.created_at as string);
    const expiresAt =
      (offerRow.expires_at as string) || new Date(Date.now() + 30000).toISOString();

    return {
      id: offerId,
      rideId,
      passengerName: passenger?.full_name || 'Cliente',
      passengerPhone: passenger?.phone ?? null,
      passengerAvatar: passenger?.avatar_url ?? null,
      origin: String(rideData.pickup_address ?? ''),
      destination: String(rideData.dropoff_address ?? ''),
      vehicleCategory: String(rideData.vehicle_category ?? rideData.pricing_category ?? 'economico'),
      offeredAt,
      expiresAt,
      status: (offerRow.status as ActiveOfferUI['status']) || 'pending',
      pickup_lat: Number(rideData.pickup_lat),
      pickup_lng: Number(rideData.pickup_lng),
    };
  },

  async acceptRideOffer(offerId: string) {
    const { data, error } = await supabase.rpc('accept_ride_offer', { p_offer_id: offerId });
    if (error) throw error;
    return data;
  },

  async respondToOffer(offerId: string, response: 'accepted' | 'rejected') {
    const { data, error } = await supabase.rpc('driver_respond_to_offer', {
      p_offer_id: offerId,
      p_response: response,
    });
    if (error) throw error;
    return data;
  },

  async isOperational(userId: string): Promise<{ operational: boolean; reason?: string }> {
    const profile = await this.getProfile(userId);
    if (!profile) return { operational: false, reason: 'Perfil não encontrado' };

    if (profile.verification_status !== 'approved' && profile.verification_status !== 'verified') {
      return { operational: false, reason: 'A sua conta ainda não foi aprovada.' };
    }

    const wallet = await this.getWallet(userId);
    if (!wallet || wallet.balance < MIN_BALANCE) {
      return {
        operational: false,
        reason: `Saldo insuficiente. Saldo mínimo: ${MIN_BALANCE} MT.`,
      };
    }

    return { operational: true };
  },

  async markAsArrived(rideId: string) {
    const { data, error } = await supabase.from('rides').update({ status: 'arrived' }).eq('id', rideId).select();
    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error('Não foi possível atualizar o estado para chegada.');
    }
  },

  async cancelRide(rideId: string, _driverUserId: string, reason?: string) {
    let { error } = await supabase.rpc('driver_cancel_ride', {
      p_ride_id: rideId,
      p_reason: reason || 'Cancelado pelo motorista',
    });

    if (error) {
      const { data, error: updateError } = await supabase
        .from('rides')
        .update({ status: 'cancelled' })
        .eq('id', rideId)
        .select();
      if (updateError) throw updateError;
      if (!data || data.length === 0) {
        throw new Error('Não foi possível cancelar a corrida.');
      }
      await supabase.from('ride_offers').update({ status: 'rejected' }).eq('ride_id', rideId);
    }
  },

  /** Delega para `routeService.syncLiveRouteFromServer` / `recalculateRoute`. */
  async maybeRefreshLiveRoute(rideId: string, driverLat: number, driverLng: number, force: boolean = false) {
    try {
      await syncLiveRouteFromServer(rideId, driverLat, driverLng, { force });
    } catch {
      /* noop */
    }
  },

  async invokeRecalculateLiveRoute(rideId: string, driverLat: number, driverLng: number) {
    return recalculateRoute(rideId, driverLat, driverLng);
  },
};
