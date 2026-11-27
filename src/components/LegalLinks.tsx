import { Link } from 'react-router-dom';
import { LEGAL_DOCS } from '@/config/legal';

const SHORT_TITLES: Record<string, string> = {
  'mentions-legales': 'Mentions légales',
  cgv: 'CGV',
  cgu: 'Conditions d’utilisation',
  confidentialite: 'Confidentialité',
};

export default function LegalLinks({ className = '' }: { className?: string }) {
  return (
    <nav aria-label="Informations légales" className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] ${className}`}>
      {LEGAL_DOCS.map(doc => (
        <Link key={doc.slug} to={`/legal/${doc.slug}`} target="_blank" rel="noopener" className="underline-offset-2 opacity-70 hover:underline hover:opacity-100">
          {SHORT_TITLES[doc.slug]}
        </Link>
      ))}
    </nav>
  );
}
