import { useMemo } from 'react';
import { Link } from 'react-router-dom';

export default function WhatsAppOAuthCallback() {
  const status = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('error')) return 'error';
    if (params.has('code')) return 'received';
    return 'missing';
  }, []);

  return (
    <main className="min-h-screen grid place-items-center bg-[#050505] px-6">
      <section className="w-full max-w-lg rounded-2xl border border-[#686D76] bg-[#171717] p-8 text-center text-white shadow-xl">
        <h1 className="text-2xl font-semibold">Connexion WhatsApp — KELYANI</h1>
        {status === 'error' ? (
          <>
            <p className="mt-4 text-sm text-gray-300">Meta a interrompu ou refusé la connexion. Vous pouvez fermer cette fenêtre et réessayer.</p>
          </>
        ) : status === 'received' ? (
          <>
            <p className="mt-4 text-sm text-gray-300">Retour Meta reçu. La finalisation sécurisée côté serveur n’est pas encore configurée; aucun token n’a été enregistré.</p>
          </>
        ) : (
          <p className="mt-4 text-sm text-gray-300">Aucun retour de connexion Meta détecté dans cette adresse.</p>
        )}
        <Link className="mt-6 inline-flex rounded-lg bg-[#686D76] px-4 py-2 text-white hover:opacity-90" to="/login">Retour à KELYANI</Link>
      </section>
    </main>
  );
}
