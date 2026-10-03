import type { SVGProps } from 'react';

export default function KelyaniMark({ size = 48, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" {...props}>
      <defs>
        <linearGradient id="kelyani-gold" x1="15" y1="15" x2="85" y2="85" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFF0B8" />
          <stop offset=".42" stopColor="#E1B65E" />
          <stop offset="1" stopColor="#9B6A24" />
        </linearGradient>
        <linearGradient id="kelyani-dark" x1="20" y1="20" x2="80" y2="80" gradientUnits="userSpaceOnUse">
          <stop stopColor="#242424" />
          <stop offset="1" stopColor="#050505" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="97" height="97" rx="28" fill="#050505" stroke="#242424"/>
      <path d="M30 20V80" stroke="url(#kelyani-gold)" strokeWidth="9" strokeLinecap="round"/>
      <path d="M33 51C46 48 54 37 72 20" stroke="url(#kelyani-gold)" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M37 52C49 54 58 65 73 80" stroke="url(#kelyani-gold)" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M30 20C42 27 44 38 36 49" stroke="url(#kelyani-dark)" strokeWidth="5" strokeLinecap="round"/>
      <path d="M30 80C43 73 45 63 37 52" stroke="url(#kelyani-dark)" strokeWidth="5" strokeLinecap="round"/>
    </svg>
  );
}
