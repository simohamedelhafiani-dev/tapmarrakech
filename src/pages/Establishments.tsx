import { useEffect, useState } from 'react';
import {
  Building2,
  Copy,
  Gift,
  ExternalLink,
  Link2,
  Plus,
  QrCode,
  Save,
  Star,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import QRCode from 'qrcode';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Establishment } from '@/lib/types';

const empty = {
  name: '',
  slug: '',
  logo_url: '',
  google_review_url: '',
  redirect_threshold: 4,
};

export default function Establishments() {
  const { user, role } = useAuth();

  const [places, setPlaces] = useState<Establishment[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [message, setMessage] = useState('');
  const [qr, setQr] = useState<{ title: string; url: string; filename: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [scannerLinks, setScannerLinks] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) {
      setPlaces([]);
      setLoading(false);
      return;
    }

    const loadEstablishments = async () => {
      setLoading(true);
      setMessage('');

      try {
        /*
         * ADMIN + RESPONSABLE
         *
         * La fonction SQL get_my_establishments()
         * retourne automatiquement :
         *
         * - Admin : tous les établissements
         * - Responsable : uniquement les établissements
         *   auxquels il est rattaché
         * - Employé : uniquement les établissements
         *   auxquels il est rattaché
         */
        const { data, error } = await supabase.rpc(
          'get_my_establishments'
        );

        if (error) {
          console.error(
            'Erreur chargement établissements:',
            error
          );

          setPlaces([]);
          setMessage(
            'Impossible de charger vos établissements.'
          );

          setLoading(false);
          return;
        }

        const nextPlaces = (data ?? []) as Establishment[];
        setPlaces(nextPlaces);

        const { data: scannerRows, error: scannerError } = await supabase
          .from('establishment_scanner_links')
          .select('establishment_id, access_token')
          .in(
            'establishment_id',
            nextPlaces.map((place) => place.id)
          );

        if (scannerError) {
          console.error('Erreur lecture des liens scanner fidélité:', scannerError);
          setScannerLinks({});
        } else {
          const links = (scannerRows ?? []).reduce<Record<string, string>>(
            (acc, row) => {
              if (row.access_token) {
                acc[row.establishment_id] =
                  window.location.origin + '/employee?scanner=' + row.access_token;
              }
              return acc;
            },
            {}
          );
          setScannerLinks(links);
        }
        setLoading(false);
      } catch (error) {
        console.error(
          'Erreur inattendue chargement établissements:',
          error
        );

        setPlaces([]);
        setMessage(
          'Une erreur est survenue lors du chargement.'
        );

        setLoading(false);
      }
    };

    loadEstablishments();
  }, [user, role]);

  const publicUrl = (slug: string) =>
    `${window.location.origin}/r/${slug}`;

  const publicLinks = (place: Establishment) => [
    { key: 'home', title: 'Page établissement', description: 'Page publique complète de l’établissement', url: publicUrl(place.slug), icon: Building2 },
    { key: 'loyalty', title: 'Programme fidélité', description: 'Accès direct à l’inscription et à la fidélité', url: publicUrl(place.slug) + '?section=loyalty', icon: Gift },
    { key: 'menu', title: 'Menu digital', description: 'Ouvre directement le menu', url: publicUrl(place.slug) + '?section=menu', icon: UtensilsCrossed },
    { key: 'reviews', title: 'Avis Google', description: 'Ouvre directement le parcours de collecte d’avis', url: publicUrl(place.slug) + '?section=reviews', icon: Star },
  ];

  const save = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    setMessage('');

    const normalizedSlug = form.slug
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-');

    /*
     * RESPONSABLE
     *
     * Il peut uniquement modifier un établissement
     * auquel il a accès.
     *
     * Il ne peut pas en créer.
     */
    if (role === 'responsible') {
      if (!editing) {
        setMessage(
          'Un responsable ne peut pas créer un établissement.'
        );
        return;
      }

      const authorizedPlace = places.find(
        (place) => place.id === editing
      );

      if (!authorizedPlace) {
        setMessage(
          'Vous n’êtes pas autorisé à modifier cet établissement.'
        );
        return;
      }

      const payload = {
        name: form.name,
        slug: normalizedSlug,
        logo_url: form.logo_url,
        google_review_url: form.google_review_url,
        redirect_threshold: form.redirect_threshold,
      };

      const result = await supabase
        .from('establishments')
        .update(payload)
        .eq('id', editing)
        .select()
        .maybeSingle();

      if (result.error) {
        console.error(
          'Erreur modification établissement:',
          result.error
        );

        setMessage(
          'Impossible de modifier cet établissement. Vérifiez vos droits.'
        );

        return;
      }

      if (result.data) {
        setPlaces((current) =>
          current.map((place) =>
            place.id === editing
              ? (result.data as Establishment)
              : place
          )
        );
      }

      setShow(false);
      setEditing(null);
      setForm(empty);
      setMessage('Établissement enregistré.');

      return;
    }

    /*
     * ADMIN
     *
     * Seul l'Admin TapMarrakech peut créer
     * de nouveaux établissements.
     */
    if (role === 'admin') {
      const payload = {
        ...form,
        slug: normalizedSlug,
        user_id: user.id,
      };

      const result = editing
        ? await supabase
            .from('establishments')
            .update(payload)
            .eq('id', editing)
            .select()
            .maybeSingle()
        : await supabase
            .from('establishments')
            .insert(payload)
            .select()
            .maybeSingle();

      if (result.error) {
        console.error(
          'Erreur enregistrement établissement:',
          result.error
        );

        setMessage(
          result.error.code === '23505'
            ? 'Ce slug est déjà utilisé.'
            : 'Impossible d’enregistrer cet établissement.'
        );

        return;
      }

      if (result.data) {
        setPlaces((current) =>
          editing
            ? current.map((place) =>
                place.id === editing
                  ? (result.data as Establishment)
                  : place
              )
            : [...current, result.data as Establishment]
        );
      }

      setShow(false);
      setEditing(null);
      setForm(empty);
      setMessage('Établissement enregistré.');
    }
  };

  const copy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setMessage('Lien copié dans le presse-papiers.');
  };

  const download = async (link: { title: string; url: string; filename: string }) => {
    const data = await QRCode.toDataURL(
      link.url,
      {
        width: 900,
        margin: 2,
        color: {
          dark: '#17352a',
          light: '#ffffff',
        },
      }
    );

    const a = document.createElement('a');
    a.href = data;
    a.download = `${link.filename}-qr.png`;
    a.click();
  };

  const openEdit = (place: Establishment) => {
    setEditing(place.id);

    setForm({
      name: place.name,
      slug: place.slug,
      logo_url: place.logo_url ?? '',
      google_review_url: place.google_review_url,
      redirect_threshold: place.redirect_threshold,
    });

    setShow(true);
  };

  if (loading) {
    return (
      <div className="grid min-h-[400px] place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-forest border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      {/* HEADER */}

      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
            Réseau
          </p>

          <h1 className="mt-2 font-display text-4xl text-forest">
            Établissements
          </h1>

          <p className="mt-2 text-sm text-ink/50">
            Gérez vos lieux et leurs liens de collecte.
          </p>
        </div>

        {role === 'admin' && (
          <button
            onClick={() => {
              setForm(empty);
              setEditing(null);
              setShow(true);
            }}
            className="flex w-fit items-center gap-2 rounded-xl bg-forest px-4 py-3 text-xs font-semibold text-white transition hover:bg-forest-light"
          >
            <Plus size={16} />
            Nouvel établissement
          </button>
        )}
      </div>

      {/* MESSAGE */}

      {message && (
        <div className="mb-5 rounded-xl bg-[#e5eee9] px-4 py-3 text-sm text-forest">
          {message}
        </div>
      )}

      {/* RESPONSABLE SANS ÉTABLISSEMENT */}

      {places.length === 0 && role === 'responsible' && (
        <div className="rounded-2xl border border-dashed border-ink/15 bg-white px-6 py-20 text-center">
          <Building2
            className="mx-auto text-gold"
            size={36}
          />

          <h2 className="mt-4 font-display text-2xl text-forest">
            Aucun établissement
          </h2>

          <p className="mx-auto mt-2 max-w-sm text-sm text-ink/50">
            Aucun établissement actif ne vous est actuellement
            rattaché.
          </p>
        </div>
      )}

      {/* ADMIN SANS ÉTABLISSEMENT */}

      {places.length === 0 && role === 'admin' && (
        <div className="rounded-2xl border border-dashed border-ink/15 bg-white px-6 py-20 text-center">
          <Building2
            className="mx-auto text-gold"
            size={36}
          />

          <h2 className="mt-4 font-display text-2xl text-forest">
            Votre réseau commence ici
          </h2>

          <p className="mx-auto mt-2 max-w-sm text-sm text-ink/50">
            Créez votre premier établissement pour obtenir
            votre lien QR et NFC.
          </p>

          <button
            onClick={() => {
              setForm(empty);
              setEditing(null);
              setShow(true);
            }}
            className="mt-6 rounded-xl bg-forest px-5 py-3 text-xs font-semibold text-white"
          >
            Créer un établissement
          </button>
        </div>
      )}

      {/* LISTE */}

      {places.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-2">
          {places.map((place) => (
            <div
              key={place.id}
              className="rounded-2xl border border-ink/5 bg-white p-5 shadow-soft"
            >
              <div className="flex items-start gap-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-forest font-display text-2xl text-gold">
                  {place.logo_url ? (
                    <img
                      src={place.logo_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    place.name[0]
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-xl text-forest">
                    {place.name}
                  </h2>

                  <p className="mt-1 truncate text-xs text-ink/40">
                    {publicUrl(place.slug)}
                  </p>
                </div>

                <button
                  onClick={() => openEdit(place)}
                  className="text-xs font-semibold text-gold"
                >
                  Modifier
                </button>
              </div>

              <div className="mt-5 rounded-2xl border border-forest/10 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-forest">Liens publics</p><p className="mt-1 text-[11px] text-ink/50">Générez un lien séparé pour chaque fonctionnalité.</p></div>
                  <Link2 size={20} className="shrink-0 text-gold" />
                </div>
                <div className="mt-4 space-y-2">
                  {publicLinks(place).map((link) => {
                    const Icon = link.icon;
                    return (
                      <div key={link.key} className="rounded-xl border border-ink/5 bg-[#f7f7f3] p-3">
                        <div className="flex items-start gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-forest"><Icon size={16} /></div><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-forest">{link.title}</p><p className="mt-0.5 text-[10px] text-ink/40">{link.description}</p><p className="mt-2 truncate rounded-lg bg-white px-2.5 py-2 text-[10px] text-ink/50">{link.url}</p></div></div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button onClick={() => copy(link.url)} className="flex items-center gap-1.5 rounded-lg bg-forest px-3 py-2 text-[10px] font-semibold text-white"><Copy size={12} />Copier</button>
                          <a href={link.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-[10px] font-semibold text-forest"><ExternalLink size={12} />Ouvrir</a>
                          <button onClick={() => setQr({ title: link.title, url: link.url, filename: place.slug + '-' + link.key })} className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-[10px] font-semibold text-forest"><QrCode size={12} />QR</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mt-5 rounded-2xl border border-gold/20 bg-[#f7f7f3] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-forest">
                      Scanner fidélité
                    </p>
                    <p className="mt-1 text-[11px] text-ink/50">
                      Lien permanent pour les employés
                    </p>
                  </div>
                  <QrCode size={20} className="shrink-0 text-gold" />
                </div>

                <div className="mt-3 rounded-xl bg-white px-3 py-2.5">
                  <p className="truncate text-[11px] text-ink/50">
                    {scannerLinks[place.id] ?? 'Génération du lien…'}
                  </p>
                </div>

                {scannerLinks[place.id] ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => copy(scannerLinks[place.id])}
                      className="flex items-center gap-1.5 rounded-lg bg-forest px-3 py-2 text-[11px] font-semibold text-white"
                    >
                      <Copy size={13} />
                      Copier le lien
                    </button>
                    <a
                      href={scannerLinks[place.id]}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-[11px] font-semibold text-forest"
                    >
                      <ExternalLink size={13} />
                      Ouvrir
                    </a>
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] text-red-600">
                    Le lien n’a pas pu être généré. Rechargez la page.
                  </p>
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-2 border-t border-ink/5 pt-4">
                <a
                  href={`/r/${place.slug}?section=menu`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-lg bg-forest px-3 py-2 text-[11px] font-semibold text-white"
                >
                  <UtensilsCrossed size={13} />
                  Voir le menu
                </a>

                <a
                  href={`/r/${place.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-lg bg-[#f7f7f3] px-3 py-2 text-[11px] font-semibold text-forest"
                >
                  <ExternalLink size={13} />
                  Voir la page
                </a>

                <button
                  onClick={() => copy(publicUrl(place.slug))}
                  className="flex items-center gap-1.5 rounded-lg bg-[#f7f7f3] px-3 py-2 text-[11px] font-semibold text-forest"
                >
                  <Copy size={13} />
                  Copier le lien
                </button>

                <button
                  onClick={() => setQr(place)}
                  className="flex items-center gap-1.5 rounded-lg bg-[#f7f7f3] px-3 py-2 text-[11px] font-semibold text-forest"
                >
                  <QrCode size={13} />
                  QR Code
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODALE */}

      {show && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-5">
          <form
            onSubmit={save}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex justify-between">
              <h2 className="font-display text-2xl text-forest">
                {editing
                  ? 'Modifier l’établissement'
                  : 'Nouvel établissement'}
              </h2>

              <button
                type="button"
                onClick={() => {
                  setShow(false);
                  setEditing(null);
                  setForm(empty);
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {[
                [
                  'name',
                  'Nom de l’établissement',
                  'Riad Atlas Marrakech',
                ],
                ['slug', 'Slug public', 'riad-atlas'],
                [
                  'logo_url',
                  'URL du logo (facultatif)',
                  'https://...',
                ],
                [
                  'google_review_url',
                  'Lien Google Reviews',
                  'https://search.google.com/local/writereview?...',
                ],
              ].map(([key, label, placeholder]) => (
                <label
                  key={key}
                  className="block text-xs font-semibold text-ink/65"
                >
                  {label}

                  <input
                    required={
                      key === 'name' ||
                      key === 'slug' ||
                      key === 'google_review_url'
                    }
                    value={String(
                      form[key as keyof typeof form]
                    )}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        [key]: e.target.value,
                      })
                    }
                    placeholder={placeholder}
                    className="mt-2 w-full rounded-xl border border-ink/10 bg-[#fbfaf7] p-3 text-sm font-normal outline-none focus:ring-2 focus:ring-gold"
                  />
                </label>
              ))}

              <label className="block text-xs font-semibold text-ink/65">
                Seuil de redirection vers Google

                <select
                  value={form.redirect_threshold}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      redirect_threshold: Number(
                        e.target.value
                      ),
                    })
                  }
                  className="mt-2 w-full rounded-xl border border-ink/10 bg-[#fbfaf7] p-3 text-sm font-normal outline-none focus:ring-2 focus:ring-gold"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} étoile{n > 1 ? 's' : ''} et plus
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <button
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-forest py-3 text-sm font-semibold text-white"
            >
              <Save size={16} />
              Enregistrer
            </button>
          </form>
        </div>
      )}

      {/* QR CODE */}

      {qr && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-5">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center">
            <div className="flex justify-end">
              <button onClick={() => setQr(null)}>
                <X size={20} />
              </button>
            </div>

            <h2 className="font-display text-2xl text-forest">
              QR Code
            </h2>

            <p className="mt-1 text-xs text-ink/50">
              {qr.title}
            </p>

            <QRCodePreview
              url={qr.url}
            />

            <button
              onClick={() => download(qr)}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-forest py-3 text-xs font-semibold text-white"
            >
              <QrCode size={16} />
              Télécharger le PNG
            </button>

            <button
              onClick={() =>
                copy(qr.url)
              }
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#f7f7f3] py-3 text-xs font-semibold text-forest"
            >
              <Link2 size={16} />
              Copier l’URL
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function QRCodePreview({ url }: { url: string }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    QRCode.toDataURL(url, {
      width: 240,
      margin: 2,
      color: {
        dark: '#17352a',
        light: '#ffffff',
      },
    }).then(setSrc);
  }, [url]);

  return src ? (
    <img
      src={src}
      alt="QR Code de l'établissement"
      className="mx-auto mt-5 h-56 w-56"
    />
  ) : (
    <div className="mx-auto mt-5 h-56 w-56 animate-pulse rounded-xl bg-ink/5" />
  );
}
