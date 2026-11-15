import { useRef, useState } from 'react';
import { Move, Save } from 'lucide-react';

type Props = {
  imageUrl: string;
  platform: 'google' | 'apple';
  establishmentId: string;
  onSaved: (url: string) => void;
};

export default function WalletImageCropEditor({ imageUrl, platform, establishmentId, onSaved }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{x:number;y:number;px:number;py:number}|null>(null);
  const [zoom,setZoom] = useState(1);
  const [x,setX] = useState(50);
  const [y,setY] = useState(50);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState('');
  const ratio = platform === 'google' ? '1032 / 812' : '1125 / 432';

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = {x,y,px:event.clientX,py:event.clientY};
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || !frameRef.current) return;
    const rect = frameRef.current.getBoundingClientRect();
    setX(Math.max(0,Math.min(100,dragRef.current.x-(event.clientX-dragRef.current.px)/rect.width*100)));
    setY(Math.max(0,Math.min(100,dragRef.current.y-(event.clientY-dragRef.current.py)/rect.height*100)));
  };
  const stopDrag = () => { dragRef.current = null; };

  const saveCrop = async () => {
    setSaving(true); setError('');
    try {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.src = imageUrl;
      await new Promise<void>((resolve,reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Impossible de charger l'image pour le cadrage."));
      });
      const width = platform === 'google' ? 1032 : 1125;
      const height = platform === 'google' ? 812 : 432;
      const scale = Math.max(width/image.naturalWidth,height/image.naturalHeight)*zoom;
      const drawWidth = image.naturalWidth*scale;
      const drawHeight = image.naturalHeight*scale;
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas indisponible.');
      context.drawImage(image,(width-drawWidth)*x/100,(height-drawHeight)*y/100,drawWidth,drawHeight);
      const blob = await new Promise<Blob>((resolve,reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Export image impossible.')),'image/jpeg',0.92));
      const { supabase } = await import('@/lib/supabase');
      const path = `loyalty-cards/${establishmentId}/wallet-${platform}-crop-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('loyalty-assets').upload(path,blob,{upsert:true,contentType:'image/jpeg'});
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('loyalty-assets').getPublicUrl(path);
      onSaved(data.publicUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Enregistrement du cadrage impossible.');
    } finally { setSaving(false); }
  };

  return <div className="mt-4 rounded-2xl border border-white/10 bg-[#090909] p-3">
    <div className="mb-3 flex items-center justify-between gap-2">
      <div><p className="text-xs font-semibold text-white">Cadrage {platform === 'google' ? 'Google Wallet' : 'Apple Wallet'}</p><p className="mt-1 text-[10px] text-white/45">Glissez l’image pour la déplacer, puis ajustez le zoom.</p></div>
      <Move size={16} className="text-[#3B82F6]" />
    </div>
    <div ref={frameRef} className="touch-none cursor-grab overflow-hidden rounded-xl active:cursor-grabbing" style={{aspectRatio:ratio,backgroundImage:`url("${imageUrl}")`,backgroundRepeat:'no-repeat',backgroundSize:`${zoom*100}% auto`,backgroundPosition:`${x}% ${y}%`}} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={stopDrag} onPointerCancel={stopDrag} role="img" aria-label={`Zone de cadrage ${platform} Wallet`} />
    <div className="mt-3 flex items-center gap-3"><label className="text-[10px] text-white/60">Zoom</label><input aria-label="Zoom image" type="range" min="1" max="3" step="0.01" value={zoom} onChange={event=>setZoom(Number(event.target.value))} className="min-w-0 flex-1 accent-[#3B82F6]" /><span className="w-10 text-right text-[10px] tabular-nums text-white/60">{zoom.toFixed(1)}×</span></div>
    <div className="mt-3 flex items-center justify-between gap-2"><button type="button" onClick={()=>{setZoom(1);setX(50);setY(50);}} className="rounded-lg px-3 py-2 text-[10px] text-white/60 hover:bg-white/5">Réinitialiser</button><button type="button" onClick={()=>void saveCrop()} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#686D76] px-3 py-2 text-[10px] font-semibold text-white disabled:opacity-50"><Save size={13}/>{saving?'Enregistrement…':'Valider ce cadrage'}</button></div>
    {error && <p className="mt-2 text-[10px] text-red-400">{error}</p>}
  </div>;
}
