import { ArrowUpRight, BrainCircuit, Gift, MessageSquareText, UtensilsCrossed } from 'lucide-react';
import { Link } from 'react-router-dom';

const tools = [
  {
    to: '/dashboard/menu',
    title: 'Menu assisté par IA',
    description: 'Accédez à la création et à l’amélioration de votre menu.',
    icon: UtensilsCrossed,
    label: 'Ouvrir le menu',
  },
  {
    to: '/dashboard/promotions',
    title: 'Promotions intelligentes',
    description: 'Préparez vos offres et campagnes de promotion.',
    icon: Gift,
    label: 'Gérer les promotions',
  },
  {
    to: '/dashboard/reviews',
    title: 'Avis clients',
    description: 'Consultez les retours clients pour identifier les sujets à traiter.',
    icon: MessageSquareText,
    label: 'Consulter les avis',
  },
];

export default function AssistantIA() {
  return (
    <section className="space-y-8">
      <header className="rounded-3xl border border-[#C9A45C]/20 bg-gradient-to-br from-[#17140D] via-[#0B0B0B] to-[#050505] p-6 sm:p-9">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#C9A45C]/25 bg-[#C9A45C]/10 px-3 py-1.5 text-xs font-semibold text-[#E1C27A]">
          <BrainCircuit size={15} /> Espace IA
        </div>
        <h1 className="max-w-2xl font-display text-3xl text-white sm:text-4xl">Votre espace d’outils intelligents</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">
          Retrouvez ici les outils KELYANI qui vous aident à travailler sur votre menu,
          vos promotions et les retours de vos clients.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tools.map(({ to, title, description, icon: Icon, label }) => (
          <article key={to} className="flex min-h-[220px] flex-col rounded-2xl border border-[#242424] bg-[#0B0B0B] p-5">
            <div className="mb-5 grid h-11 w-11 place-items-center rounded-xl border border-[#C9A45C]/20 bg-[#C9A45C]/10 text-[#E1C27A]">
              <Icon size={20} />
            </div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-white/50">{description}</p>
            <Link to={to} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#E1C27A] hover:text-[#F1D99B]">
              {label} <ArrowUpRight size={16} />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
