import type { ImgHTMLAttributes } from 'react';

type KelyaniMarkProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt' | 'width' | 'height'> & {
  size?: number;
};

export default function KelyaniMark({ size = 120, className, ...props }: KelyaniMarkProps) {
  return (
    <img
      src="/kelyani-emerald.svg"
      alt="KELYANI - Logiciel de Fidélisation Client au Maroc"
      width={size}
      height={size}
      className={className}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        objectPosition: 'center',
        flexShrink: 0,
        display: 'block',
        ...props.style,
      }}
      {...props}
    />
  );
}
