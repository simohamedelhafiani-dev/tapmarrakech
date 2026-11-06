import type { ImgHTMLAttributes } from 'react';

type KelyaniMarkProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt' | 'width' | 'height'> & {
  size?: number;
};

export default function KelyaniMark({ size = 120, className, ...props }: KelyaniMarkProps) {
  return (
    <img
      src="/Logo Kelyani en dégradé teal et vert.png"
      alt="Kelyani — L’art de la relation client"
      width={size}
      height={Math.round(size * 2 / 3)}
      className={className}
      style={{
        width: size,
        height: 'auto',
        aspectRatio: '3 / 2',
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
