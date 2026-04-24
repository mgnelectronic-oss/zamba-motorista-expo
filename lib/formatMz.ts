/** Espelha `formatCurrency` / `formatAddress` em `Zamba-Motorista-/src/pages/History.tsx`. */

export function formatCurrencyMzn(value: number): string {
  return new Intl.NumberFormat('pt-MZ', {
    style: 'currency',
    currency: 'MZN',
    minimumFractionDigits: 2,
  })
    .format(value)
    .replace('MZN', 'MT');
}

export function formatAddress(address: string | null | undefined): string {
  if (!address) return '';
  if (address === 'Localização Atual' || address === 'Current Location') {
    return 'Ponto de recolha';
  }
  return address;
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return '??';
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}
