import { useEffect, useState } from 'react';
import { ArrowRight, Check, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

function AuthShell({ children, title, eyebrow }: { children: React.ReactNode; title: string; eyebrow: string }) { return <div className="grid min-h-screen bg-[#f7f7f3] lg:grid-cols-[1fr_1.1fr]"><div className="hidden bg-forest p-12 text-white lg:flex lg:flex-col lg:justify-between"><div className="font-display text-2xl">KELYANI</div><div><p className="mb-5 text-xs font-semibold uppercase tracking-[0.25em] text-gold">La voix de vos clients</p><h2 className="max-w-md font-display text-5xl leading-[1.1]">Transformez chaque retour en fidélité.</h2><p className="mt-6 max-w-sm text-sm leading-7 text-white/55">Une expérience simple pour vos clients. Des insights précieux pour votre établissement.</p></div><p className="text-xs text-white/35">© 2026 KELYANI</p></div><div className="flex items-center justify-center p-6"><div className="w-full max-w-[420px]"><div className="mb-10 lg:hidden"><div className="font-display text-2xl text-forest">KELYANI</div></div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">{eyebrow}</p><h1 className="mt-3 font-display text-4xl text-forest">{title}</h1>{children}</div></div></div>; }
function Field({ icon: Icon, ...props }: { icon: typeof Mail } & React.InputHTMLAttributes<HTMLInputElement>) { return <div className="relative"><Icon size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" /><input {...props} className="w-full rounded-xl border border-ink/10 bg-white py-3 pl-10 pr-3 text-sm outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20" /></div>; }
export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setResendMessage('');
    setNeedsConfirmation(false);
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (authError) {
      if (authError.message.toLowerCase().includes('email not confirmed')) {
        setError("Votre adresse e-mail n’est pas encore confirmée.");
        setNeedsConfirmation(true);
      } else {
        setError(authError.message.includes('Invalid login credentials') ? 'Email ou mot de passe incorrect.' : 'La connexion à Supabase a échoué. Vérifiez les variables Vercel et réessayez.');
      }
    } else {
      navigate(location.state?.from?.pathname || '/dashboard');
    }
    setBusy(false);
  };

  const resendConfirmation = async () => {
    setResending(true);
    setResendMessage('');
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setResending(false);
    setResendMessage(resendError
      ? "Impossible de renvoyer l’e-mail. Vérifiez l’adresse ou réessayez dans quelques minutes."
      : "Si cette inscription est toujours en attente, un nouvel e-mail de confirmation va être envoyé.");
  };

  return <AuthShell eyebrow="Espace professionnel" title="Bon retour.">
    <form onSubmit={submit} className="mt-9 space-y-4">
      <Field icon={Mail} type="email" required placeholder="Adresse email" value={email} onChange={e => setEmail(e.target.value)} />
      <Field icon={LockKeyhole} type="password" required placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-forest py-3.5 text-sm font-semibold text-white transition hover:bg-forest-light disabled:opacity-50">{busy ? 'Connexion…' : 'Se connecter'} <ArrowRight size={16} /></button>
    </form>
    {needsConfirmation && <div className="mt-4 rounded-xl border border-gold/40 bg-white p-4">
      <p className="text-sm text-ink/70">Confirmez votre adresse pour activer votre compte KELYANI.</p>
      <button type="button" disabled={resending || !email.trim()} onClick={resendConfirmation} className="mt-3 w-full rounded-xl border border-gold px-3 py-2 text-sm font-semibold text-forest disabled:opacity-50">{resending ? 'Envoi…' : 'Renvoyer l’e-mail de confirmation'}</button>
      {resendMessage && <p role="status" className="mt-3 text-sm text-ink/70">{resendMessage}</p>}
    </div>}
    <div className="mt-5 flex justify-between text-xs"><Link to="/forgot-password" className="text-forest underline underline-offset-4">Mot de passe oublié ?</Link><Link to="/register" className="font-semibold text-gold">Créer un compte</Link></div>
  </AuthShell>;
}
export function Register() { const navigate = useNavigate(); const [form, setForm] = useState({ name: '', email: '', password: '' }); const [error, setError] = useState(''); const submit = async (e: React.FormEvent) => { e.preventDefault(); setError(''); const { data, error: authError } = await supabase.auth.signUp({ email: form.email.trim(), password: form.password, options: { data: { name: form.name.trim() }, emailRedirectTo: `${window.location.origin}/auth/callback` } }); if (authError) { setError(authError.message.includes('already') ? 'Un compte existe déjà avec cet email.' : 'Impossible de créer le compte.'); return; } if (data.user && data.session) { const { error: profileError } = await supabase.from('profiles').upsert({ id: data.user.id, email: form.email.trim(), name: form.name.trim() }, { onConflict: 'id' }); if (profileError) { setError('Le compte est créé mais le profil n’a pas pu être enregistré.'); return; } navigate('/dashboard'); } else { setError('Compte créé. Vérifiez votre email avant de vous connecter.'); } }; return <AuthShell eyebrow="Commencer simplement" title="Créez votre espace."><form onSubmit={submit} className="mt-9 space-y-4"><Field icon={UserRound} required placeholder="Votre nom" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /><Field icon={Mail} type="email" required placeholder="Adresse email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /><Field icon={LockKeyhole} type="password" minLength={6} required placeholder="Mot de passe (6 caractères minimum)" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />{error && <p className="text-sm text-red-600">{error}</p>}<button className="flex w-full items-center justify-center gap-2 rounded-xl bg-forest py-3.5 text-sm font-semibold text-white transition hover:bg-forest-light">Créer mon compte <ArrowRight size={16} /></button></form><p className="mt-5 text-center text-xs text-ink/50">Déjà inscrit ? <Link to="/login" className="font-semibold text-gold">Se connecter</Link></p></AuthShell>; }
export function ForgotPassword() { const [email, setEmail] = useState(''); const [sent, setSent] = useState(false); const [error, setError] = useState(''); const submit = async (e: React.FormEvent) => { e.preventDefault(); setError(''); const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` }); if (resetError) { setError('Impossible d’envoyer le lien. Vérifiez l’adresse email et réessayez.'); return; } setSent(true); }; return <AuthShell eyebrow="Accès sécurisé" title="Réinitialiser l’accès.">{sent ? <div className="mt-9 rounded-2xl bg-white p-5 text-sm text-ink/70"><Check className="mb-2 text-forest" />Si un compte correspond à cette adresse, vous recevrez un email avec les instructions.</div> : <form onSubmit={submit} className="mt-9 space-y-4"><Field icon={Mail} type="email" required placeholder="Adresse email" value={email} onChange={e => setEmail(e.target.value)} />{error && <p className="text-sm text-red-600">{error}</p>}<button className="w-full rounded-xl bg-forest py-3.5 text-sm font-semibold text-white transition hover:bg-forest-light">Recevoir le lien</button><Link to="/login" className="block text-center text-xs text-gold">Retour à la connexion</Link></form>}</AuthShell>; }


export function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [updated, setUpdated] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    if (password !== confirmation) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (updateError) {
      setError('Le lien de réinitialisation est invalide ou expiré. Demandez un nouveau lien.');
      return;
    }

    setUpdated(true);
    setTimeout(() => navigate('/login', { replace: true }), 1200);
  };

  return (
    <AuthShell eyebrow="Accès sécurisé" title="Définir un nouveau mot de passe.">
      {updated ? (
        <div className="mt-9 rounded-2xl bg-white p-5 text-sm text-ink/70">
          <Check className="mb-2 text-forest" />
          Votre mot de passe a été mis à jour. Redirection vers la connexion…
        </div>
      ) : (
        <form onSubmit={submit} className="mt-9 space-y-4">
          <Field icon={LockKeyhole} type="password" minLength={6} required placeholder="Nouveau mot de passe" value={password} onChange={e => setPassword(e.target.value)} />
          <Field icon={LockKeyhole} type="password" minLength={6} required placeholder="Confirmer le mot de passe" value={confirmation} onChange={e => setConfirmation(e.target.value)} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-forest py-3.5 text-sm font-semibold text-white transition hover:bg-forest-light disabled:opacity-50">
            {saving ? 'Mise à jour…' : 'Enregistrer le nouveau mot de passe'} <ArrowRight size={16} />
          </button>
        </form>
      )}
    </AuthShell>
  );
}


export function EmailConfirmation() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'checking' | 'success' | 'expired' | 'error'>('checking');
  const [email, setEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    const finishConfirmation = async () => {
      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get('token_hash');
      const type = params.get('type');
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const errorCode = hash.get('error_code') || params.get('error_code');
      if (errorCode === 'otp_expired' || hash.get('error') === 'access_denied') {
        if (active) setStatus('expired');
        return;
      }
      if (tokenHash && (type === 'signup' || type === 'email')) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'email' });
        if (active) setStatus(error ? 'expired' : 'success');
        return;
      }
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session?.user) setStatus('success');
      else if (error) setStatus('error');
      else setStatus('expired');
    };
    void finishConfirmation();
    return () => { active = false; };
  }, []);

  const resend = async (event: React.FormEvent) => {
    event.preventDefault();
    setResending(true);
    setMessage('');
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setResending(false);
    setMessage(error ? 'Impossible de renvoyer le lien pour le moment. Vérifiez l’adresse et réessayez.' : 'Si cette adresse correspond à une inscription en attente, un nouvel e-mail de confirmation va être envoyé.');
  };

  return (
    <AuthShell eyebrow="Confirmation sécurisée" title={status === 'success' ? 'Adresse confirmée.' : status === 'checking' ? 'Vérification en cours…' : status === 'expired' ? 'Lien expiré.' : 'Confirmation impossible.'}>
      {status === 'checking' ? (
        <div className="mt-9 rounded-2xl border border-ink/10 bg-white p-5 text-sm text-ink/70">Nous vérifions votre adresse e-mail. Veuillez patienter.</div>
      ) : status === 'success' ? (
        <div className="mt-9 rounded-2xl border border-ink/10 bg-white p-5 text-sm text-ink/70">
          <Check className="mb-3 text-forest" />
          Votre adresse e-mail est confirmée. Vous pouvez maintenant vous connecter à KELYANI.
          <button type="button" onClick={() => navigate('/login')} className="mt-5 w-full rounded-xl bg-forest py-3 font-semibold text-white">Se connecter</button>
        </div>
      ) : (
        <div className="mt-9 rounded-2xl border border-ink/10 bg-white p-5">
          <p className="text-sm text-ink/70">Ce lien de confirmation est invalide ou a expiré. Demandez un nouveau lien pour terminer la création de votre compte.</p>
          <form onSubmit={resend} className="mt-5 space-y-3">
            <Field icon={Mail} type="email" required placeholder="Adresse email utilisée à l’inscription" value={email} onChange={e => setEmail(e.target.value)} />
            {message && <p role="status" className="text-sm text-ink/70">{message}</p>}
            <button disabled={resending} className="w-full rounded-xl bg-forest py-3 text-sm font-semibold text-white disabled:opacity-50">{resending ? 'Envoi…' : 'Renvoyer l’e-mail de confirmation'}</button>
          </form>
          <Link to="/login" className="mt-5 block text-center text-xs text-gold">Retour à la connexion</Link>
        </div>
      )}
    </AuthShell>
  );
}
