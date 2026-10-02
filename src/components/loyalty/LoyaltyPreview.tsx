import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { LoyaltyExperienceConfig } from './LoyaltyExperience';

type LoyaltyPreviewProps = { config: LoyaltyExperienceConfig };

type WalletTemplate = {
  id: string;
  name: string;
  background: string;
  text: string;
  accent: string;
  primary: string;
  fontFamily: string;
  effect: 'gradient' | 'glass' | 'solid';
};

export const WALLET_TEMPLATES: Record<string, WalletTemplate> = {
  'onyx-black': { id:'onyx-black', name:'Onyx Black', background:'#070707', text:'#FFFFFF', accent:'#D7D7D7', primary:'#181818', fontFamily:'Inter, ui-sans-serif, system-ui, sans-serif', effect:'gradient' },
  'royal-gold': { id:'royal-gold', name:'Royal Gold', background:'#17110A', text:'#FFF8E8', accent:'#D6B15A', primary:'#6E4B18', fontFamily:'Georgia, serif', effect:'gradient' },
  'deep-ocean': { id:'deep-ocean', name:'Deep Ocean', background:'#061923', text:'#F4FCFF', accent:'#6FD3E8', primary:'#0D4050', fontFamily:'Inter, ui-sans-serif, system-ui, sans-serif', effect:'glass' },
  'minimal-white': { id:'minimal-white', name:'Minimal White', background:'#F5F5F2', text:'#151515', accent:'#777777', primary:'#FFFFFF', fontFamily:'Inter, ui-sans-serif, system-ui, sans-serif', effect:'solid' },
  'forest-green': { id:'forest-green', name:'Forest Green', background:'#071A14', text:'#F7FFF9', accent:'#B9D8A4', primary:'#164D3A', fontFamily:'Georgia, serif', effect:'gradient' },
  'ruby-red': { id:'ruby-red', name:'Ruby Red', background:'#21080D', text:'#FFF5F5', accent:'#E8A0A8', primary:'#6D1724', fontFamily:'Georgia, serif', effect:'gradient' },
  'silver-chrome': { id:'silver-chrome', name:'Silver Chrome', background:'#777B80', text:'#FFFFFF', accent:'#F5F5F5', primary:'#BFC4C9', fontFamily:'Inter, ui-sans-serif, system-ui, sans-serif', effect:'gradient' },
  'midnight-blue': { id:'midnight-blue', name:'Midnight Blue', background:'#080D24', text:'#F4F7FF', accent:'#9DB7FF', primary:'#17275F', fontFamily:'Inter, ui-sans-serif, system-ui, sans-serif', effect:'glass' },
};

function hexToRgb(hex: string) {
  const value = hex.replace('#','').trim();
  const normalized = value.length === 3 ? value.split('').map(c => c+c).join('') : value;
  const number = Number.parseInt(normalized,16);
  if (!Number.isFinite(number)) return {r:0,g:0,b:0};
  return {r:(number>>16)&255,g:(number>>8)&255,b:number&255};
}
function getContrastColor(color: string) {
  if (!color?.startsWith('#')) return '#FFFFFF';
  const {r,g,b}=hexToRgb(color);
  return ((0.299*r+0.587*g+0.114*b)/255)<0.55 ? '#FFFFFF' : '#111111';
}
function clamp(value:number,min:number,max:number){return Math.min(Math.max(value,min),max);}

export default function LoyaltyPreview({ config }: LoyaltyPreviewProps) {
  const [qr,setQr]=useState('');
  const template=WALLET_TEMPLATES[config.templateId || ''] || WALLET_TEMPLATES['onyx-black'];
  const type=config.type;
  const isStamp=type==='STAMP' || type==='CHALLENGE' || type==='COLLECTION';
  const isDiscount=type==='POINTS_DISCOUNT' || type==='DISCOUNT';
  const isPointsReward=type==='POINTS_REWARD' || type==='POINTS' || type==='REWARD';

  const backgroundColor=config.backgroundColor || template.background;
  const primaryColor=config.primaryColor || template.primary;
  const accentColor=config.secondaryColor || template.accent;
  const textColor=config.textColor || getContrastColor(backgroundColor);

  
  const wallpaper = config.coverImageUrl || (config as LoyaltyExperienceConfig & { wallpaperUrl?: string | null }).wallpaperUrl || null;
  const backgroundImage=wallpaper
    ? `linear-gradient(145deg, ${primaryColor}CC 0%, ${primaryColor}88 48%, ${primaryColor}55 100%),url("${wallpaper}")`
    : template.effect==='glass'
    ? `linear-gradient(135deg, ${primaryColor}CC 0%, transparent 48%, ${accentColor}22 100%),linear-gradient(145deg,rgba(255,255,255,.10),rgba(255,255,255,0) 48%)`
    : template.effect==='gradient'
      ? `linear-gradient(145deg,${backgroundColor} 0%,${primaryColor} 52%,${backgroundColor} 100%),linear-gradient(145deg,${primaryColor}66,transparent 55%,${accentColor}22)`
      : `linear-gradient(145deg,${primaryColor}66,transparent 55%,${accentColor}22)`;

  useEffect(()=>{
    let active=true;
    if(!config.qrValue){setQr('');return;}
    void QRCode.toDataURL(config.qrValue,{width:260,margin:1,color:{dark:'#111111',light:'#FFFFFF'}})
      .then(v=>{if(active)setQr(v);}).catch(()=>{if(active)setQr('');});
    return()=>{active=false;};
  },[config.qrValue]);

  const points=config.pointsBalance ?? 0;
  const pointsGoal=Math.max(1,config.pointsGoal ?? 1000);
  const threshold=Math.max(1,config.discountPointsThreshold ?? pointsGoal);
  const discountProgress=clamp((points/threshold)*100,0,100);
  const visits=clamp(config.visits ?? 0,0,Math.max(1,config.visitGoal ?? 10));
  const visitGoal=Math.max(1,config.visitGoal ?? 10);
  const rewards=(config.rewards ?? []).slice(0,2);

  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',width:'100%',height:'100%',minHeight:0,minWidth:0,overflow:'hidden',boxSizing:'border-box'}}>
      <div style={{
        width:'300px',height:'450px',minHeight:'450px',minWidth:'300px',overflow:'hidden',boxSizing:'border-box',
        position:'relative',display:'flex',flexDirection:'column',justifyContent:'space-between',
        borderRadius:'34px',border:'1px solid rgba(255,255,255,.20)',backgroundColor,backgroundImage,
        backgroundSize:'cover',backgroundPosition:'center',backgroundRepeat:'no-repeat',color:textColor,fontFamily:template.fontFamily,
        boxShadow:'inset 0 1px 0 rgba(255,255,255,.18),inset 0 -24px 50px rgba(0,0,0,.20),0 24px 60px rgba(0,0,0,.20)',padding:'22px'
      }}>
        <div style={{position:'absolute',inset:0,pointerEvents:'none',background:'linear-gradient(125deg,rgba(255,255,255,.16),rgba(255,255,255,.04) 22%,rgba(255,255,255,0) 48%,rgba(255,255,255,.06) 72%,rgba(255,255,255,0))'}}/>
        <div style={{position:'relative',zIndex:1,display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,width:'100%'}}>
          <div style={{minWidth:0,overflow:'hidden',fontSize:14,fontWeight:700,whiteSpace:'nowrap',textOverflow:'ellipsis'}}>{config.establishmentName || 'Votre établissement'}</div>
          {config.logoUrl ? <img src={config.logoUrl} alt="" style={{width:38,height:38,flexShrink:0,objectFit:'contain',borderRadius:14,padding:6,boxSizing:'border-box',backgroundColor:'rgba(255,255,255,.92)'}}/> :
            <div style={{width:48,height:48,flexShrink:0,display:'grid',placeItems:'center',borderRadius:14,border:'1px solid rgba(255,255,255,.22)',backgroundColor:'rgba(255,255,255,.10)',fontSize:11,fontWeight:700}}>{(config.establishmentName||'CL').slice(0,2).toUpperCase()}</div>}
        </div>

        <div style={{position:'relative',zIndex:1,flex:1,minHeight:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',width:'100%'}}>
          {isStamp && (
            <>
              <div style={{fontSize:11,fontWeight:800,letterSpacing:'.28em',textTransform:'uppercase',color:accentColor}}>CARTE À TAMPONS</div>
              <div style={{marginTop:10,fontSize:32,fontWeight:900,lineHeight:1}}>{config.visits ?? 0}<span style={{fontSize:16,opacity:.45}}> / {visitGoal}</span></div>
              <div style={{marginTop:18,width:'100%',display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8}}>
                {Array.from({length:visitGoal}).map((_,i)=>(
                  <div key={i} style={{height:36,borderRadius: i<visits ? 12 : 10,border:`1px solid ${accentColor}`,background:i<visits ? `${accentColor}35` : 'transparent',display:'grid',placeItems:'center',color:accentColor,fontSize:13,fontWeight:800}}>
                    {i<visits ? '✓' : '·'}
                  </div>
                ))}
              </div>
              <div style={{marginTop:16,fontSize:11,opacity:.62}}>{config.rewardName || 'Cadeau fidélité'}</div>
              <div style={{marginTop:5,fontSize:9,letterSpacing:'.12em',textTransform:'uppercase',opacity:.42}}>Objectif {visitGoal} tampons</div>
            </>
          )}

          {isPointsReward && (
            <>
              <div style={{fontSize:11,fontWeight:800,letterSpacing:'.28em',textTransform:'uppercase',color:accentColor}}>POINTS & RÉCOMPENSES</div>
              <div style={{marginTop:10,fontSize:40,fontWeight:900,lineHeight:1}}>{points.toLocaleString('fr-FR')}<span style={{fontSize:15,opacity:.5}}> pts</span></div>
              <div style={{marginTop:20,width:'100%',display:'grid',gap:8}}>
                {rewards.length ? rewards.map(reward=>(
                  <div key={reward.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,padding:'10px 12px',borderRadius:14,border:`1px solid ${accentColor}55`,background:'rgba(255,255,255,.08)',textAlign:'left'}}>
                    <div style={{minWidth:0}}>
                      <div style={{fontSize:11,fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{reward.name}</div>
                      <div style={{marginTop:2,fontSize:8,opacity:.5}}>{reward.description || 'Récompense fidélité'}</div>
                    </div>
                    <div style={{fontSize:10,fontWeight:800,color:accentColor,whiteSpace:'nowrap'}}>{reward.points_required} pts</div>
                  </div>
                )) : <div style={{fontSize:11,opacity:.55}}>Ajoutez vos premières récompenses.</div>}
              </div>
            </>
          )}

          {isDiscount && (
            <>
              <div style={{fontSize:11,fontWeight:800,letterSpacing:'.28em',textTransform:'uppercase',color:accentColor}}>OBJECTIF RÉDUCTION</div>
              <div style={{marginTop:10,fontSize:52,fontWeight:900,lineHeight:1}}>{points.toLocaleString('fr-FR')}<span style={{fontSize:15,opacity:.5}}> pts</span></div>
              <div style={{marginTop:18,width:'100%',height:8,borderRadius:99,background:'rgba(255,255,255,.14)',overflow:'hidden'}}>
                <div style={{height:'100%',width:`${discountProgress}%`,borderRadius:99,background:accentColor}}/>
              </div>
              <div style={{marginTop:10,display:'flex',justifyContent:'space-between',width:'100%',fontSize:9,opacity:.55}}>
                <span>0</span><span>Seuil {threshold} pts</span>
              </div>
              <div style={{marginTop:22,padding:'14px 18px',width:'100%',boxSizing:'border-box',borderRadius:18,border:`1px solid ${accentColor}66`,background:`${accentColor}18`}}>
                <div style={{fontSize:10,fontWeight:800,letterSpacing:'.18em',textTransform:'uppercase',color:accentColor}}>Réduction débloquée</div>
                <div style={{marginTop:4,fontSize:34,fontWeight:900}}>-{Number(config.discountPercent ?? 10)}%</div>
                <div style={{marginTop:3,fontSize:9,opacity:.55}}>Valable {Math.max(1,Number(config.discountValidDays)||7)} jours après déblocage</div>
              </div>
            </>
          )}

          <div style={{marginTop:18,width:70,height:1,background:accentColor,opacity:.5}}/>
          <div style={{marginTop:9,fontSize:9,fontWeight:700,letterSpacing:'.2em',textTransform:'uppercase',color:accentColor,opacity:.78}}>{config.currentTier || 'MEMBER'}</div>
        </div>

        <div style={{position:'relative',zIndex:1,display:'flex',flexDirection:'column',alignItems:'center',width:'100%'}}>
          <div style={{background:'#FFF',padding:7,borderRadius:14,boxShadow:'0 14px 35px rgba(0,0,0,.28)',display:'grid',placeItems:'center',width:82,height:82,boxSizing:'border-box'}}>
            {qr ? <img src={qr} alt="QR Code fidélité" style={{display:'block',width:66,height:66}}/> : <div style={{width:92,height:92}}/>}
          </div>
          <div style={{marginTop:10,fontSize:10,fontWeight:700,letterSpacing:'.18em',textTransform:'uppercase',opacity:.58}}>{config.customerName || 'Client'}</div>
        </div>
      </div>
    </div>
  );
}
