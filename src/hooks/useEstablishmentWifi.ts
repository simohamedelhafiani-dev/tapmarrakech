import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type EstablishmentWifi = {
  id: string;
  establishment_id: string;
  network_name: string | null;
  wifi_password: string | null;
  security_type: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export function useEstablishmentWifi(establishmentId: string | null) {
  const [wifi, setWifi] = useState<EstablishmentWifi | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadWifi = useCallback(async () => {
    if (!establishmentId) {
      setWifi(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('establishment_wifi')
      .select('id, establishment_id, network_name, wifi_password, security_type, active, created_at, updated_at')
      .eq('establishment_id', establishmentId)
      .maybeSingle();

    if (fetchError) {
      setError(fetchError);
      setWifi(null);
      setLoading(false);
      return;
    }

    setWifi(data ? (data as EstablishmentWifi) : null);
    setLoading(false);
  }, [establishmentId]);

  useEffect(() => {
    void loadWifi();
  }, [loadWifi]);

  const saveWifi = useCallback(
    async (input: {
      network_name: string;
      wifi_password: string;
      security_type: string;
      active: boolean;
    }) => {
      if (!establishmentId) {
        return { success: false, error: new Error('Établissement indisponible.') };
      }

      const networkName = input.network_name.trim();
      if (!networkName) {
        const validationError = new Error('Le nom du réseau est obligatoire.');
        setError(validationError);
        return { success: false, error: validationError };
      }

      setSaving(true);
      setError(null);

      const payload = {
        establishment_id: establishmentId,
        network_name: networkName,
        wifi_password: input.wifi_password || null,
        security_type: input.security_type.trim() || 'WPA',
        active: input.active,
      };

      let result;

      if (wifi?.id) {
        result = await supabase
          .from('establishment_wifi')
          .update(payload)
          .eq('id', wifi.id)
          .select('id, establishment_id, network_name, wifi_password, security_type, active, created_at, updated_at')
          .single();
      } else {
        result = await supabase
          .from('establishment_wifi')
          .insert(payload)
          .select('id, establishment_id, network_name, wifi_password, security_type, active, created_at, updated_at')
          .single();
      }

      if (result.error) {
        setError(result.error);
        setSaving(false);
        return { success: false, error: result.error };
      }

      const normalized = result.data as EstablishmentWifi;
      setWifi(normalized);
      setSaving(false);

      console.log('[EstablishmentWifi] SAVE SUCCESS:', {
        establishmentId,
        wifiId: normalized.id,
        networkName: normalized.network_name,
        securityType: normalized.security_type,
        active: normalized.active,
      });

      return { success: true, wifi: normalized };
    },
    [establishmentId, wifi?.id],
  );

  return {
    wifi,
    loading,
    saving,
    error,
    saveWifi,
    reload: loadWifi,
  };
}
