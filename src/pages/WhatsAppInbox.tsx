import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

type Establishment = { id: string; name?: string };
type Message = { id: string; direction: 'inbound' | 'outbound'; message_type: string; body: string | null; delivery_status: string; created_at: string };
type Conversation = { id: string; customer_phone: string; customer_name: string | null; status: string; last_message_at: string; last_message?: Message | null };
const dateLabel = (value: string) => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));

export default function WhatsAppInbox() {
  const location = useLocation();
  const isAdminPath = location.pathname.startsWith('/admin/whatsapp');
  const connectPath = isAdminPath ? '/admin/whatsapp/connect' : '/dashboard/whatsapp';
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [establishmentId, setEstablishmentId] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const conversationLoadSequence = useRef(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase.rpc('get_my_establishments');
      if (!alive) return;
      if (error) { setNotice('Impossible de charger les établissements.'); setLoading(false); return; }
      const rows = (data ?? []) as Establishment[];
      setEstablishments(rows);
      setEstablishmentId(rows[0]?.id ?? '');
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const loadInbox = async (id: string) => {
    // Invalidate pending conversation-detail responses whenever the inbox is reloaded.
    conversationLoadSequence.current += 1;
    // Clear the previous detail view immediately so stale messages are not shown on refresh/errors.
    setSelected(null); setMessages([]); setDetailLoading(false);
    if (!id) { setConversations([]); return; }
    setLoading(true); setNotice('');
    const { data, error } = await supabase.functions.invoke('whatsapp-inbox', { body: { establishmentId: id, limit: 50 } });
    if (error || !data) { setNotice('Boîte WhatsApp indisponible. La fonction serveur doit être déployée.'); setLoading(false); return; }
    setConversations((data.conversations ?? []) as Conversation[]);
    setSelected(null); setMessages([]); setLoading(false);
  };

  useEffect(() => { void loadInbox(establishmentId); }, [establishmentId]);

  async function openConversation(conversation: Conversation) {
    const requestSequence = ++conversationLoadSequence.current;
    setSelected(conversation); setMessages([]); setDetailLoading(true); setNotice('');
    const { data, error } = await supabase.functions.invoke('whatsapp-inbox', { body: { establishmentId, conversationId: conversation.id } });
    // Rapid conversation switches can complete out of order. Ignore stale responses.
    if (requestSequence !== conversationLoadSequence.current) return;
    if (error || !data) setNotice('Impossible de charger cette conversation.');
    else setMessages((data.messages ?? []) as Message[]);
    setDetailLoading(false);
  }

  async function sendMessage() {
    if (!selected || !draft.trim() || sending) return;
    setSending(true); setNotice('');
    const { data, error } = await supabase.functions.invoke('whatsapp-send-message', {
      body: { establishmentId, to: selected.customer_phone.startsWith('+') ? selected.customer_phone : `+${selected.customer_phone}`, text: draft.trim(), requestId: crypto.randomUUID() },
    });
    // A 202 queued response is not a send failure: Meta may have accepted the
    // message while the network outcome is unknown. Refresh to show the persisted
    // outbound record and avoid prompting the user to send a duplicate.
    const pending = Boolean(data?.pending) || data?.status === 'queued';
    if (error || (!data?.success && !pending)) {
      setNotice(data?.error === 'whatsapp_not_connected' ? 'WhatsApp n’est pas connecté pour cet établissement.' : 'Envoi impossible. Vérifie la connexion WhatsApp et réessaie.');
      setSending(false);
      return;
    }
    if (!pending) setDraft('');
    // Refresh the list first: loadInbox clears the selected conversation.
    // Reopen it afterwards so the inbox remains focused on the conversation just answered.
    const sentConversation = selected;
    await loadInbox(establishmentId);
    await openConversation(sentConversation);
    if (pending) setNotice('Message enregistré en attente de confirmation Meta. Ne le renvoie pas pour éviter un doublon.');
    setSending(false);
  }

  const selectedLabel = useMemo(() => selected?.customer_name || selected?.customer_phone || 'Conversation', [selected]);
  return (
    <main className="mx-auto w-full max-w-7xl p-4 text-white md:p-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-widest text-[#3B82F6]">KELYANI WhatAI</p><h1 className="mt-1 text-2xl font-semibold">Boîte WhatsApp</h1><p className="mt-1 text-sm text-white/45">Conversations entrantes et réponses manuelles.</p></div>
        <Link to={connectPath} className="rounded-xl border border-[#686D76] px-4 py-2 text-sm text-white/70 hover:text-white">Connexion WhatsApp</Link>
      </header>
      {establishments.length > 1 && <label className="mb-4 block max-w-md text-xs text-white/60">Établissement<select value={establishmentId} onChange={e=>setEstablishmentId(e.target.value)} className="mt-2 w-full rounded-xl border border-[#686D76] bg-[#161616] p-3 text-sm text-white">{establishments.map(x=><option key={x.id} value={x.id}>{x.name||x.id}</option>)}</select></label>}
      {notice && <p role="status" className="mb-4 rounded-xl border border-[#686D76] p-3 text-sm text-white/70">{notice}</p>}
      <div className="grid min-h-[560px] overflow-hidden rounded-2xl border border-[#262626] bg-[#111] md:grid-cols-[340px_1fr]">
        <section className="border-b border-[#262626] md:border-b-0 md:border-r">
          <div className="border-b border-[#262626] p-4"><h2 className="font-semibold">Messages</h2><p className="mt-1 text-xs text-white/35">{conversations.length} conversation(s)</p></div>
          {loading ? <p className="p-6 text-sm text-white/40">Chargement…</p> : conversations.length === 0 ? <div className="p-6 text-center text-sm text-white/35">Aucune conversation. Les messages reçus apparaîtront ici.</div> : <div className="max-h-[65vh] overflow-y-auto">{conversations.map(c=><button key={c.id} type="button" onClick={()=>void openConversation(c)} className={`block w-full border-b border-[#252525] p-4 text-left hover:bg-[#191919] ${selected?.id===c.id?'bg-[#191919]':''}`}><div className="flex items-center justify-between gap-2"><strong className="truncate text-sm">{c.customer_name||c.customer_phone}</strong><span className="shrink-0 text-[10px] text-white/30">{dateLabel(c.last_message_at)}</span></div><p className="mt-1 truncate text-xs text-white/45">{c.last_message?.body || (c.last_message?.message_type ? `[${c.last_message.message_type}]` : 'Pas encore de message')}</p></button>)}</div>}
        </section>
        <section className="flex min-h-[560px] flex-col">
          {!selected ? <div className="grid flex-1 place-items-center p-8 text-center text-sm text-white/35">Sélectionne une conversation pour afficher les messages.</div> : <>
            <div className="border-b border-[#262626] p-4"><h2 className="font-semibold">{selectedLabel}</h2><p className="mt-1 text-xs text-white/35">{selected.customer_phone}</p></div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">{detailLoading ? <p className="text-sm text-white/40">Chargement…</p> : messages.map(m=><div key={m.id} className={`flex ${m.direction==='outbound'?'justify-end':'justify-start'}`}><div className={`max-w-[85%] rounded-2xl p-3 ${m.direction==='outbound'?'bg-[#686D76] text-black':'bg-[#202020] text-white'}`}><p className="whitespace-pre-wrap break-words text-sm">{m.body||`Message ${m.message_type}`}</p><p className="mt-1 text-right text-[9px] opacity-50">{dateLabel(m.created_at)} · {m.delivery_status}</p></div></div>)}</div>
            <div className="border-t border-[#262626] p-3"><textarea value={draft} onChange={e=>setDraft(e.target.value)} rows={2} maxLength={4096} placeholder="Écrire un message…" className="w-full resize-none rounded-xl border border-[#333] bg-[#080808] p-3 text-sm outline-none focus:border-[#3B82F6]" /><div className="mt-2 flex justify-end"><button type="button" onClick={()=>void sendMessage()} disabled={sending||!draft.trim()} className="rounded-xl bg-[#3B82F6] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{sending?'Envoi…':'Envoyer'}</button></div><p className="mt-2 text-[10px] text-white/25">L’envoi dépend de la fonction WhatsApp serveur et de l’activation Meta.</p></div>
          </>}
        </section>
      </div>
    </main>
  );
}
