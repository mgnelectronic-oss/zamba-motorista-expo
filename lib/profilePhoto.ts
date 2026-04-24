/**
 * Ordem de prioridade alinhada ao pedido: `profiles.avatar_url` → `profiles.selfie_url` → foto em documentos (`driver_photo_path` mapeado como `driver_selfie` URL).
 */
export function resolveProfilePhotoUrl(opts: {
  avatarUrl?: string | null;
  selfieUrl?: string | null;
  driverDocumentPhotoUrl?: string | null;
}): string | null {
  const candidates = [opts.avatarUrl, opts.selfieUrl, opts.driverDocumentPhotoUrl];
  const found = candidates.find((u) => typeof u === 'string' && u.trim().length > 0);
  return found?.trim() ?? null;
}
