import { useState } from 'react';
import { imageUrl } from '../config';

interface Props {
  name: string;
  alt?: string;
  className?: string;
  eager?: boolean;
  style?: React.CSSProperties;
}

/** Фото из public/img с плавным проявлением после загрузки. */
export function Img({ name, alt = '', className = '', eager, style }: Props) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className={`img ${className}`} style={style}>
      <img
        src={imageUrl(name)}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
        className={loaded ? 'loaded' : ''}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
      />
    </div>
  );
}
