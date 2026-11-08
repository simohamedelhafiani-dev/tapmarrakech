import { useEffect, useState } from 'react';
import { ArrowRight, Globe2, ShieldCheck, UserRound, Eye, EyeOff } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useLanguage, type Language } from '@/contexts/LanguageContext';
import KelyaniMark from '@/components/brand/KelyaniMark';

type LoginRole = 'admin' | 'responsible' | null;

export default function Login() {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();
  const { language, setLanguage, t } = useLanguage();

  const [selectedRole, setSelectedRole] = useState<LoginRole>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading || !user) return;
    if (role === 'admin') navigate('/admin', { replace: true });
    if (role === 'responsible') navigate('/dashboard', { replace: true });
  }, [loading, user, role, navigate]);

  function selectRole(nextRole: LoginRole) {
    setError('');
    setEmail('');
    setPassword('');
    setSelectedRole(nextRole);
  }

  async function handleLogin() {
    setError('');
    if (!email.trim() || !password) {
      setError('Veuillez saisir votre email et votre mot de passe.');
      return;
    }

    setSaving(true);
    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (loginError || !data.user) {
      setSaving(false);
      setError(loginError?.message ?? 'Email ou mot de passe incorrect.');
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileError || !profile) {
      await supabase.auth.signOut();
      setSaving(false);
      setError('Impossible de déterminer votre accès.');
      return;
    }

    if (selectedRole === 'admin' && profile.role !== 'admin') {
      await supabase.auth.signOut();
      setSaving(false);
      setError('Ce compte n’est pas un compte administrateur.');
      return;
    }

    if (selectedRole === 'responsible' && profile.role !== 'responsible') {
      await supabase.auth.signOut();
      setSaving(false);
      setError('Ce compte n’est pas un compte responsable.');
      return;
    }

    setSaving(false);
    if (profile.role === 'admin') navigate('/admin', { replace: true });
    else if (profile.role === 'responsible') navigate('/dashboard', { replace: true });
    else navigate('/login', { replace: true });
  }

  return (
    <main className="kelyani-login-v2 min-h-screen text-[#F2F5F6]">
      <div className="login-v2-noise" />
      <header className="login-v2-header">
        <KelyaniMark size={154} className="login-v2-logo" />
        <label className="login-v2-language"><Globe2 size={15}/><select value={language} onChange={(event) => setLanguage(event.target.value as Language)} aria-label="Language"><option value="fr">FR</option><option value="en">EN</option><option value="ar">AR</option></select></label>
      </header>
      <div className="login-v2-layout">
        <section className="login-v2-visual">
          <div className="login-v2-copy">
            <span className="login-v2-eyebrow"><i/> L’ART DE LA RELATION CLIENT</span>
            <h1>Chaque client compte.<br/><span>Chaque retour rapporte.</span></h1>
            <p>KELYANI transforme chaque interaction en une relation durable : valorisez vos avis, récompensez la fidélité et donnez à vos clients une vraie raison de revenir. Plus de visites, plus d’achats répétés, un chiffre d’affaires qui progresse.</p>
          </div>
          <div className="login-v2-scene login-v2-scene-refined" aria-label="Aperçu de l'expérience KELYANI">
            <div className="scene-refined-grid"/>
            <div className="scene-refined-glow"/>
            <div className="scene-refined-orbit orbit-one"/>
            <div className="scene-refined-orbit orbit-two"/>
            <div className="scene-refined-back-card">
              <div className="scene-back-top"><span>KELYANI</span><span>MEMBER EXPERIENCE</span></div>
              <div className="scene-back-lines"><i/><i/><i/></div>
              <div className="scene-back-chip"/>
            </div>
            <div className="scene-refined-main-card scene-loyalty-pass">
              <div className="loyalty-pass-head">
                <div className="loyalty-pass-brand"><span className="loyalty-pass-logo">K</span><span><b>KELYANI</b><small>PROGRAMME FIDÉLITÉ</small></span></div>
                <span className="loyalty-pass-tier">PRIVILÈGE</span>
              </div>
              <div className="loyalty-pass-stamp-title">CARTE À TAMPONS</div>
              <div className="loyalty-pass-count"><b>08</b><span>/ 10</span></div>
              <div className="loyalty-pass-stamps">{Array.from({length:10},(_,i)=><span key={i} className={i<8?'is-filled':''}>{i<8?'✦':''}</span>)}</div>
              <div className="loyalty-pass-reward"><span className="loyalty-pass-gift">✧</span><span><small>VOTRE CADEAU</small><b>Une récompense vous attend</b><i>Plus que 2 visites</i></span><span className="loyalty-pass-progress">80%</span></div>
              <div className="loyalty-pass-foot"><span>MEMBRE FIDÈLE</span><span>UNE VISITE = UN POINT</span></div>
              <div className="scene-card-shine"/>
            </div>
            <div className="scene-refined-stat scene-stat-reviews"><span className="scene-stat-icon">✦</span><span><small>AVIS CLIENTS</small><b>4.9 <em>★</em></b><i>Excellente réputation</i></span></div>
            <div className="scene-refined-stat scene-stat-growth"><span className="scene-stat-icon">↗</span><span><small>CLIENTS FIDÉLISÉS</small><b>+28%</b><i>Engagement en hausse</i></span></div>
            <div className="scene-refined-notification"><span className="scene-notif-avatar">S</span><span><small>NOUVELLE RÉCOMPENSE</small><b>Sarah a débloqué un cadeau</b></span><span className="scene-notif-check">✓</span></div>
            <div className="scene-refined-caption"><span/><b>UNE EXPÉRIENCE QUI DONNE ENVIE DE REVENIR</b></div>
          </div>
          <div className="login-v2-bottomline"><span>01 — RELATION</span><span>02 — INTELLIGENCE</span><span>03 — CROISSANCE</span></div>
        </section>
        <section className="login-v2-auth">
          <div className="login-v2-auth-card">
            <div className="login-v2-auth-top"><span className="login-v2-auth-icon"><ShieldCheck size={18}/></span><span>ENVIRONNEMENT SÉCURISÉ</span><span className="login-v2-auth-line"/></div>
            <h2>{selectedRole ? 'Ravi de vous revoir.' : 'Votre espace.'}<br/><span>{selectedRole ? 'Connectez-vous à KELYANI.' : 'Votre relation client commence ici.'}</span></h2>
            <p className="login-v2-auth-desc">{selectedRole ? 'Accédez à votre environnement de pilotage.' : 'Sélectionnez votre profil pour continuer.'}</p>
            {!selectedRole ? (
              <div className="login-v2-roles">
                {([
                  { id: 'admin' as const, title: 'Administrateur', desc: 'Pilotage global de la plateforme', Icon: ShieldCheck },
                  { id: 'responsible' as const, title: 'Responsable', desc: 'Gestion de votre établissement', Icon: UserRound },
                ]).map(({id,title,desc,Icon}) => (
                  <button key={id} type="button" onClick={() => selectRole(id)} className="login-v2-role">
                    <span className="login-v2-role-icon"><Icon size={20}/></span><span className="login-v2-role-copy"><b>{title}</b><i>{desc}</i></span><ArrowRight className="login-v2-role-arrow" size={19}/>
                  </button>
                ))}
                <Link to="/register" className="login-v2-create"><span>Vous découvrez KELYANI ? <b>Créer un compte</b></span><ArrowRight size={17}/></Link>
              </div>
            ) : (
              <div className="login-v2-form">
                <button type="button" className="login-v2-back" onClick={() => selectRole(null)}>← Changer de profil</button>
                <div className="login-v2-selected-role">{selectedRole === 'admin' ? <ShieldCheck size={17}/> : <UserRound size={17}/>} {selectedRole === 'admin' ? 'Administrateur' : 'Responsable'}</div>
                {error && <p role="alert" className="login-v2-error">{error}</p>}
                <label className="login-v2-field"><span>ADRESSE E-MAIL</span><input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')handleLogin()}} placeholder={t.emailPlaceholder}/></label>
                <label className="login-v2-field"><span>MOT DE PASSE <Link to="/forgot-password">{t.forgot}</Link></span><div className="login-v2-password"><input type={showPassword?'text':'password'} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')handleLogin()}} placeholder={t.passwordPlaceholder}/><button type="button" aria-label={showPassword?'Masquer le mot de passe':'Afficher le mot de passe'} onClick={()=>setShowPassword(v=>!v)}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>
                <button type="button" disabled={saving} onClick={handleLogin} className="login-v2-submit"><span>{saving?'Connexion en cours…':'Accéder à mon espace'}</span><ArrowRight size={18}/></button>
                <Link to="/register" className="login-v2-register">{t.createAccount}</Link>
              </div>
            )}
            <div className="login-v2-security"><span>⌑</span> Vos données restent protégées et confidentielles</div>
          </div>
          <footer className="login-v2-footer"><span>© KELYANI 2026</span><span>L’ART DE LA RELATION CLIENT</span></footer>
        </section>
      </div>
    </main>
  );
}
