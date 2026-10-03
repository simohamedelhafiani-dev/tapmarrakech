import type { ImgHTMLAttributes } from 'react';

type KelyaniMarkProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt' | 'width' | 'height'> & {
  size?: number;
};

export default function KelyaniMark({ size = 48, className, ...props }: KelyaniMarkProps) {
  return (
    <img
      src="/Logo Kelyani doré sur fond noir (1).png"
      alt="KELYANI"
      width={size}
      height={size}
      className={className}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        objectPosition: 'center',
        flexShrink: 0,
        ...props.style,
      }}
      {...props}
    />
  );
}
