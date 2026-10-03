import type { ImgHTMLAttributes } from 'react';

type KelyaniMarkProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt' | 'width' | 'height'> & {
  size?: number;
};

export default function KelyaniMark({ size = 48, className, ...props }: KelyaniMarkProps) {
  return (
    <img
      src="/Logo Kelyani doré sur fond noir (1).png"
      alt="KELYANI"
      width={Math.round(size * 1.18)}
      height={size}
      className={className}
      style={{ width: Math.round(size * 1.18), height: size, objectFit: 'contain', objectPosition: 'left center', ...props.style }}
      {...props}
    />
  );
}
