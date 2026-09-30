import { useRef, useState } from 'react';
import { CheckCircle2, ImagePlus, Loader2, Trash2, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { type EstablishmentProfile, useEstablishmentProfile } from '@/hooks/useEstablishmentProfile';

const BUCKET = 'establishment-logos';
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

type UploadLogoProps = {
  profile: EstablishmentProfile;
  engine: ReturnType<typeof useEstablishmentProfile>;
};

const getExtension = (file: File) => {
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  return 'jpg';
};

const getStoragePath = (publicUrl: string | null) => {
  if (!publicUrl) return null;
  const marker = '/storage/v1/object/public/establishment-logos/';
  const index = publicUrl.indexOf(marker);
  return index >= 0 ? decodeURIComponent(publicUrl.slice(index + marker.length)) : null;
};

export default function UploadLogo({ profile, engine }: UploadLogoProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleUpload = async (file: File) => {
    setMessage('');
    setError('');

    if (!ALLOWED_TYPES.has(file.type)) {
      setError('Format non pris en charge. Utilisez PNG, JPG ou WebP.');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError('Le logo doit faire 5 Mo maximum.');
      return;
    }

    setUploading(true);

    const extension = getExtension(file);
    const path = `establishments/${profile.id}/logo-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false,
    });

    if (uploadError) {
      setUploading(false);
      setError(uploadError.message || 'Impossible d’envoyer le logo.');
      return;
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const previousPath = getStoragePath(profile.logo_url);

    const { error: dbError } = await supabase
      .from('establishments')
      .update({ logo_url: data.publicUrl })
      .eq('id', profile.id);

    if (dbError) {
      await supabase.storage.from(BUCKET).remove([path]);
      setUploading(false);
      setError(dbError.message || 'Le logo a été envoyé mais n’a pas pu être enregistré.');
      return;
    }

    if (previousPath && previousPath !== path) {
      await supabase.storage.from(BUCKET).remove([previousPath]);
    }

    await engine.reload();
    setUploading(false);
    setMessage('Logo mis à jour.');
  };

  const handleRemove = async () => {
    setMessage('');
    setError('');

    if (!profile.logo_url) return;

    setRemoving(true);
    const previousPath = getStoragePath(profile.logo_url);

    const { error: dbError } = await supabase
      .from('establishments')
      .update({ logo_url: null })
      .eq('id', profile.id);

    if (dbError) {
      setRemoving(false);
      setError(dbError.message || 'Impossible de supprimer le logo.');
      return;
    }

    if (previousPath) {
      const { error: storageError } = await supabase.storage.from(BUCKET).remove([previousPath]);
      if (storageError) {
        setError('Le logo a été retiré du profil, mais le fichier Storage n’a pas pu être supprimé.');
      } else {
        setMessage('Logo supprimé.');
      }
    } else {
      setMessage('Logo supprimé.');
    }

    await engine.reload();
    setRemoving(false);
  };

  return (
    <div className="rounded-[26px] border border-ink/5 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.045)]">
      <div className="flex flex-col gap-5 md:flex-row md:items-center">
        <div className="grid h-28 w-28 shrink-0 place-items-center overflow-hidden rounded-3xl bg-forest text-3xl font-semibold text-gold ring-1 ring-ink/5">
          {profile.logo_url ? (
            <img src={profile.logo_url} alt={`Logo ${profile.name}`} className="h-full w-full object-cover" />
          ) : (
            <ImagePlus size={30} className="text-gold" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-forest">Logo de l’établissement</p>
          <p className="mt-1 text-xs leading-5 text-ink/45">PNG, JPG ou WebP · 5 Mo maximum.</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={uploading || removing || engine.saving}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              {uploading ? 'Upload en cours…' : profile.logo_url ? 'Remplacer le logo' : 'Importer un logo'}
            </button>

            {profile.logo_url && (
              <button
                type="button"
                disabled={uploading || removing || engine.saving}
                onClick={() => void handleRemove()}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-xs font-semibold text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {removing ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                {removing ? 'Suppression…' : 'Supprimer'}
              </button>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            disabled={uploading || removing || engine.saving}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.currentTarget.value = '';
              if (file) void handleUpload(file);
            }}
          />

          {message && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-forest">
              <CheckCircle2 size={14} />
              {message}
            </p>
          )}

          {error && <p className="mt-3 text-[11px] font-medium text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
