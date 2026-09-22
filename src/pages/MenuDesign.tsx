import { useEffect, useRef, useState } from 'react';
import { Check, ImagePlus, Loader2, Upload, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type Establishment = { id: string; name: string };
type MenuDesignConfig = {
  background_image_url?: string | null;
  wallpaper_library?: string[];
};

const emptyDesign: MenuDesignConfig = {
  background_image_url: null,
  wallpaper_library: [],
};

export default function MenuDesign() {
  const { user } = useAuth();
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [establishmentId, setEstablishmentId] = useState('');
  const [design, setDesign] = useState<MenuDesignConfig>(emptyDesign);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user?.id) return;
    void loadEstablishments();
  }, [user?.id]);

  useEffect(() => {
    if (establishmentId) void loadDesign();
  }, [establishmentId]);

  async function loadEstablishments() {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_my_establishments');
    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const rows = (data ?? []).map((row: { id: string; name: string }) => ({
      id: row.id,
      name: row.name,
    }));

    setEstablishments(rows);
    if (rows.length) setEstablishmentId((current) => current || rows[0].id);
    setLoading(false);
  }

  async function loadDesign() {
    setLoading(true);

    const { data, error } = await supabase
      .from('establishments')
      .select('menu_ai_design')
      .eq('id', establishmentId)
      .maybeSingle();

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const raw =
      data?.menu_ai_design &&
      typeof data.menu_ai_design === 'object' &&
      !Array.isArray(data.menu_ai_design)
        ? (data.menu_ai_design as Record<string, unknown>)
        : {};

    setDesign({
      background_image_url:
        typeof raw.background_image_url === 'string'
          ? raw.background_image_url
          : null,
      wallpaper_library: Array.isArray(raw.wallpaper_library)
        ? raw.wallpaper_library.filter(
            (value): value is string => typeof value === 'string'
          )
        : [],
    });

    setLoading(false);
  }

  async function persist(next: MenuDesignConfig) {
    const { data: currentRow, error: readError } = await supabase
      .from('establishments')
      .select('menu_ai_design')
      .eq('id', establishmentId)
      .maybeSingle();

    if (readError) {
      alert(readError.message);
      return;
    }

    const current =
      currentRow?.menu_ai_design &&
      typeof currentRow.menu_ai_design === 'object' &&
      !Array.isArray(currentRow.menu_ai_design)
        ? (currentRow.menu_ai_design as Record<string, unknown>)
        : {};

    const merged = {
      ...current,
      ...next,
      wallpaper_library: next.wallpaper_library ?? [],
    };

    const { error } = await supabase.rpc('update_establishment_menu_design', {
      p_establishment_id: establishmentId,
      p_menu_ai_design: merged,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setDesign(next);
  }

  async function uploadWallpapers(files: FileList | null) {
    if (!files?.length || !establishmentId) return;

    setUploading(true);

    try {
      const uploaded: string[] = [];

      for (const file of Array.from(files)) {
        const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const path =
          'loyalty-cards/' +
          establishmentId +
          '/wallpaper-' +
          Date.now() +
          '-' +
          Math.random().toString(36).slice(2) +
          '.' +
          extension;

        const { error } = await supabase.storage
          .from('loyalty-assets')
          .upload(path, file, {
            upsert: false,
            contentType: file.type,
          });

        if (error) throw error;

        uploaded.push(
          supabase.storage.from('loyalty-assets').getPublicUrl(path).data.publicUrl
        );
      }

      const nextLibrary = Array.from(
        new Set([...(design.wallpaper_library ?? []), ...uploaded])
      );

      await persist({
        ...design,
        wallpaper_library: nextLibrary,
        background_image_url:
          design.background_image_url || uploaded[0] || null,
      });
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : 'Impossible d’ajouter le wallpaper.'
      );
    } finally {
      setUploading(false);
    }
  }

  async function selectWallpaper(url: string) {
    await persist({
      ...design,
      background_image_url: url,
    });
  }

  async function removeWallpaper(url: string) {
    const nextLibrary = (design.wallpaper_library ?? []).filter(
      (item) => item !== url
    );

    const nextActive =
      design.background_image_url === url
        ? nextLibrary[0] ?? null
        : design.background_image_url ?? null;

    await persist({
      ...design,
      wallpaper_library: nextLibrary,
      background_image_url: nextActive,
    });
  }

  if (loading && !establishments.length) {
    return (
      <div className="grid min-h-[400px] place-items-center">
        <Loader2 className="animate-spin text-gold" size={22} />
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <section className="rounded-[28px] bg-forest p-6 text-white shadow-xl md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gold">
              Menu digital
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Personnaliser le wallpaper
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
              Choisis l’image qui devient le fond complet de ton menu digital.
            </p>
          </div>

          <select
            value={establishmentId}
            onChange={(event) => setEstablishmentId(event.target.value)}
            className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white outline-none"
          >
            {establishments.map((establishment) => (
              <option
                key={establishment.id}
                value={establishment.id}
                className="text-ink"
              >
                {establishment.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="rounded-3xl border border-ink/8 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold">
              Bibliothèque
            </p>
            <h2 className="mt-1 text-xl font-semibold text-forest">
              Wallpapers du menu
            </h2>
            <p className="mt-1 text-sm text-ink/45">
              Le wallpaper actif est utilisé sur le menu public.
            </p>
          </div>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading || !establishmentId}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-forest px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Upload size={16} />
            )}
            {uploading ? 'Upload…' : 'Ajouter des wallpapers'}
          </button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          className="hidden"
          onChange={(event) => {
            void uploadWallpapers(event.target.files);
            event.currentTarget.value = '';
          }}
        />

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {(design.wallpaper_library ?? []).map((url) => (
            <div
              key={url}
              className={
                'group relative overflow-hidden rounded-2xl border-2 ' +
                (design.background_image_url === url
                  ? 'border-gold ring-2 ring-gold/20'
                  : 'border-ink/10')
              }
            >
              <button
                type="button"
                onClick={() => void selectWallpaper(url)}
                className="block w-full text-left"
              >
                <div className="aspect-[3/4] bg-ink/5">
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </div>

                {design.background_image_url === url && (
                  <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-gold text-white shadow">
                    <Check size={13} />
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => void removeWallpaper(url)}
                className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-black/55 text-white opacity-0 transition group-hover:opacity-100"
                aria-label="Supprimer"
              >
                <X size={14} />
              </button>
            </div>
          ))}

          {!design.wallpaper_library?.length && (
            <div className="col-span-full rounded-2xl border border-dashed border-ink/10 px-5 py-10 text-center">
              <ImagePlus className="mx-auto text-gold" size={28} />
              <p className="mt-3 text-sm font-semibold text-forest">
                Aucun wallpaper
              </p>
              <p className="mt-1 text-xs text-ink/40">
                Ajoute une image pour commencer.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-ink/8 bg-white p-6 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold">
          Aperçu
        </p>
        <h2 className="mt-1 text-xl font-semibold text-forest">Fond actif</h2>

        {design.background_image_url ? (
          <div className="mt-5 overflow-hidden rounded-[28px] border border-ink/10">
            <div
              className="relative min-h-[520px] bg-cover bg-center p-8"
              style={{
                backgroundImage:
                  'url("' + design.background_image_url + '")',
              }}
            >
              <div className="absolute inset-0 bg-black/35" />
              <div className="relative rounded-3xl border border-white/15 bg-white/10 p-6 text-white backdrop-blur-[2px]">
                <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-gold">
                  Menu
                </p>
                <h3 className="mt-2 font-display text-4xl">
                  {establishments.find((item) => item.id === establishmentId)
                    ?.name || 'Votre établissement'}
                </h3>
                <p className="mt-2 max-w-sm text-sm text-white/70">
                  Votre carte, vos catégories, vos produits, sur votre propre
                  univers visuel.
                </p>
                <div className="mt-8 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-white/15 p-4 backdrop-blur-sm">
                    Entrées
                  </div>
                  <div className="rounded-2xl bg-white/15 p-4 backdrop-blur-sm">
                    Plats
                  </div>
                  <div className="rounded-2xl bg-white/15 p-4 backdrop-blur-sm">
                    Desserts
                  </div>
                  <div className="rounded-2xl bg-white/15 p-4 backdrop-blur-sm">
                    Boissons
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-ink/45">
            Aucun wallpaper actif.
          </p>
        )}
      </section>
    </div>
  );
}
