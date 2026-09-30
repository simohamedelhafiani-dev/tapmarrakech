import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Save,
  ShieldCheck,
} from 'lucide-react';
import {
  type EstablishmentProfile,
  type ProfileValidationErrors,
  type SlugStatus,
  validateEstablishmentProfile,
  useEstablishmentProfile,
} from '@/hooks/useEstablishmentProfile';

type ProfileBusinessType = {
  id: string;
  name: string;
  active: boolean;
};

type ProfileFormProps = {
  engine: ReturnType<typeof useEstablishmentProfile>;
  businessTypes: ProfileBusinessType[];
  onSaved?: () => Promise<void> | void;
};

const inputClass = (error?: string) =>
  `w-full rounded-xl border bg-[#fbfbf8] px-3 py-3 text-sm outline-none transition focus:border-forest/30 ${error ? 'border-red-300 focus:border-red-400' : 'border-ink/10'}`;

function Field({
  label,
  value,
  onChange,
  error,
  type = 'text',
  placeholder,
  disabled,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink/55">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        className={inputClass(error)}
      />
      {error && <span className="mt-1.5 block text-[11px] font-medium text-red-600">{error}</span>}
    </label>
  );
}

function slugState(status: SlugStatus, message: string) {
  if (status === 'checking') {
    return { className: 'text-amber-600', text: message || 'Vérification de disponibilité…' };
  }
  if (status === 'taken' || status === 'invalid' || status === 'error') {
    return { className: 'text-red-600', text: message || 'Slug invalide.' };
  }
  if (status === 'available') {
    return { className: 'text-forest', text: message || 'Slug disponible.' };
  }
  return null;
}

export default function ProfileForm({ engine, businessTypes, onSaved }: ProfileFormProps) {
  const [touched, setTouched] = useState<Partial<Record<keyof EstablishmentProfile, boolean>>>({});
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');

  const profile = engine.profile;

  const liveErrors = useMemo<ProfileValidationErrors>(() => {
    return profile ? validateEstablishmentProfile(profile) : {};
  }, [profile]);

  if (engine.loading) {
    return (
      <div className="rounded-[26px] border border-ink/5 bg-white p-8 shadow-[0_12px_40px_rgba(15,23,42,0.045)]">
        <div className="flex items-center gap-3 text-sm text-ink/45">
          <Loader2 size={17} className="animate-spin text-forest" />
          Chargement du profil…
        </div>
      </div>
    );
  }

  if (engine.error || !profile) {
    return (
      <div className="rounded-[26px] border border-red-100 bg-white p-8 shadow-[0_12px_40px_rgba(15,23,42,0.045)]">
        <p className="text-sm font-semibold text-red-700">Impossible de charger le profil.</p>
        <p className="mt-1 text-xs text-ink/45">{engine.error?.message ?? 'Profil indisponible.'}</p>
        <button
          type="button"
          onClick={() => void engine.reload()}
          className="mt-4 rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-white"
        >
          Réessayer
        </button>
      </div>
    );
  }

  const setField = <K extends keyof EstablishmentProfile>(field: K, value: EstablishmentProfile[K]) => {
    setTouched((current) => ({ ...current, [field]: true }));
    setSaveMessage('');
    setSaveError('');
    engine.setField(field, value);
  };

  const slugWasChanged = engine.initialSlug !== null && profile.slug !== engine.initialSlug;
  const slugInfo = slugState(engine.slugStatus, engine.slugMessage);
  const hasBlockingErrors = Object.keys(liveErrors).length > 0 || engine.slugStatus === 'taken' || engine.slugStatus === 'invalid' || engine.slugStatus === 'error' || engine.slugStatus === 'checking';
  const showError = (field: keyof ProfileValidationErrors) => touched[field as keyof EstablishmentProfile] ? liveErrors[field] : undefined;

  const handleSave = async () => {
    setTouched(
      Object.keys(liveErrors).reduce(
        (acc, key) => ({ ...acc, [key]: true }),
        {} as Partial<Record<keyof EstablishmentProfile, boolean>>,
      ),
    );
    setSaveMessage('');
    setSaveError('');

    const result = await engine.updateProfile();

    if (!result.success) {
      setSaveError(result.error?.message ?? 'Impossible d’enregistrer le profil.');
      return;
    }

    setSaveMessage('Profil enregistré avec succès.');
    await onSaved?.();
  };

  return (
    <div className="space-y-5">
      <div className="rounded-[26px] border border-ink/5 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.045)]">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold">Identité</p>
            <h3 className="mt-1 text-lg font-semibold text-forest">Informations de l’établissement</h3>
            <p className="mt-1 text-xs text-ink/40">Ces informations alimentent la page publique et les modules de l’établissement.</p>
          </div>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-forest/5 px-3 py-1.5 text-[10px] font-semibold text-forest">
            <ShieldCheck size={13} />
            Profil sécurisé
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Nom"
            value={profile.name}
            onChange={(value) => setField('name', value)}
            error={showError('name')}
            disabled={engine.saving}
            autoComplete="organization"
          />

          <div>
            <Field
              label="Slug public"
              value={profile.slug}
              onChange={(value) => setField('slug', value.toLowerCase())}
              error={showError('slug')}
              disabled={engine.saving}
              placeholder="mon-etablissement"
            />
            {slugInfo && !showError('slug') && (
              <p className={`mt-1.5 text-[11px] font-medium ${slugInfo.className}`}>
                {slugInfo.text}
              </p>
            )}
            {slugWasChanged && (
              <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] leading-4 text-amber-800">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>Attention, modifier le slug changera l’URL publique de votre établissement.</span>
              </div>
            )}
          </div>

          <Field label="Adresse" value={profile.address ?? ''} onChange={(value) => setField('address', value || null)} disabled={engine.saving} autoComplete="street-address" />
          <Field label="Ville" value={profile.city ?? ''} onChange={(value) => setField('city', value || null)} disabled={engine.saving} autoComplete="address-level2" />
          <Field label="Téléphone" value={profile.phone ?? ''} onChange={(value) => setField('phone', value || null)} error={showError('phone')} disabled={engine.saving} type="tel" autoComplete="tel" />
          <Field label="Email" value={profile.email ?? ''} onChange={(value) => setField('email', value || null)} error={showError('email')} disabled={engine.saving} type="email" autoComplete="email" />
          <Field label="Site web" value={profile.website_url ?? ''} onChange={(value) => setField('website_url', value || null)} error={showError('website_url')} disabled={engine.saving} placeholder="https://..." />
          <Field label="WhatsApp" value={profile.whatsapp_number ?? ''} onChange={(value) => setField('whatsapp_number', value || null)} error={showError('whatsapp_number')} disabled={engine.saving} type="tel" />

          <Field label="Instagram" value={profile.instagram_url ?? ''} onChange={(value) => setField('instagram_url', value || null)} error={showError('instagram_url')} disabled={engine.saving} placeholder="https://instagram.com/..." />
          <Field label="Facebook" value={profile.facebook_url ?? ''} onChange={(value) => setField('facebook_url', value || null)} error={showError('facebook_url')} disabled={engine.saving} placeholder="https://facebook.com/..." />
          <Field label="TikTok" value={profile.tiktok_url ?? ''} onChange={(value) => setField('tiktok_url', value || null)} error={showError('tiktok_url')} disabled={engine.saving} placeholder="https://tiktok.com/@..." />

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-ink/55">Type d’établissement</span>
            <select
              value={profile.ai_business_type_id ?? ''}
              onChange={(event) => setField('ai_business_type_id', event.target.value || null)}
              disabled={engine.saving}
              className={inputClass(showError('ai_business_type_id'))}
            >
              <option value="">Sélectionner un type</option>
              {businessTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
            {showError('ai_business_type_id') && (
              <span className="mt-1.5 block text-[11px] font-medium text-red-600">{showError('ai_business_type_id')}</span>
            )}
          </label>

          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-xs font-medium text-ink/55">Description</span>
            <textarea
              value={profile.description ?? ''}
              onChange={(event) => setField('description', event.target.value || null)}
              disabled={engine.saving}
              rows={5}
              className={inputClass(showError('description'))}
              placeholder="Présentez brièvement votre établissement…"
            />
            <div className="mt-1.5 flex items-center justify-between gap-3">
              {showError('description') ? (
                <span className="text-[11px] font-medium text-red-600">{showError('description')}</span>
              ) : (
                <span className="text-[11px] text-ink/35">2000 caractères maximum.</span>
              )}
              <span className="text-[11px] text-ink/35">{(profile.description ?? '').length}/2000</span>
            </div>
          </label>
        </div>
      </div>

      <div className="rounded-[26px] border border-ink/5 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.045)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-forest text-2xl font-semibold text-gold">
            {profile.logo_url ? (
              <img src={profile.logo_url} alt={`Logo ${profile.name}`} className="h-full w-full object-cover" />
            ) : (
              profile.name?.[0]?.toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-forest">Logo de l’établissement</p>
            <p className="mt-1 text-xs leading-5 text-ink/45">Le logo est utilisé par la page publique et les espaces établissement.</p>
            <input
              value={profile.logo_url ?? ''}
              onChange={(event) => setField('logo_url', event.target.value || null)}
              disabled={engine.saving}
              placeholder="https://.../logo.png"
              className="mt-3 w-full rounded-xl border border-ink/10 bg-[#fbfbf8] px-3 py-2.5 text-sm outline-none focus:border-forest/30"
            />
            {profile.logo_url && (
              <button type="button" onClick={() => setField('logo_url', null)} disabled={engine.saving} className="mt-2 text-xs font-medium text-red-600">
                Supprimer le logo
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-ink/5 bg-[#f7f7f3] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-forest">Enregistrement du profil</p>
            <p className="mt-1 text-[11px] text-ink/40">
              {engine.isDirty ? 'Des modifications non enregistrées sont présentes.' : 'Aucune modification en attente.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {saveMessage && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-forest">
                <CheckCircle2 size={14} />
                {saveMessage}
              </span>
            )}
            {saveError && <span className="max-w-xs text-[11px] font-medium text-red-600">{saveError}</span>}
            <button
              type="button"
              disabled={engine.saving || !engine.isDirty || hasBlockingErrors}
              onClick={() => void handleSave()}
              className="inline-flex items-center gap-2 rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white transition hover:bg-forest-light disabled:cursor-not-allowed disabled:opacity-40"
            >
              {engine.saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {engine.saving ? 'Enregistrement…' : 'Enregistrer le profil'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
