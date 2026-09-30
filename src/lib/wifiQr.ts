export type EstablishmentWifiQrInput = {
  network_name: string | null;
  wifi_password: string | null;
  security_type: string | null;
};

const escapeWifiValue = (value: string) =>
  value.replace(/[\\;,:]/g, (character) => '\\' + character);

export function buildWifiQrPayload(wifi: EstablishmentWifiQrInput): string {
  const ssid = escapeWifiValue(wifi.network_name?.trim() ?? '');
  const password = escapeWifiValue(wifi.wifi_password ?? '');
  const security = (wifi.security_type?.trim() || 'WPA').toUpperCase();

  if (!ssid) return '';

  if (security === 'NOPASS') {
    return 'WIFI:T:nopass;S:' + ssid + ';P:;;';
  }

  return 'WIFI:T:' + escapeWifiValue(security) + ';S:' + ssid + ';P:' + password + ';;';
}
