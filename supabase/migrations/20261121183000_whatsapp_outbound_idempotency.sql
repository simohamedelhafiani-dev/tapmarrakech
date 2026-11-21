-- Idempotency support for outgoing WhatsApp messages.
-- Nullable so existing inbound and historical outbound rows remain unchanged.
alter table public.whatsapp_messages
  add column if not exists client_request_id uuid;

create unique index if not exists whatsapp_messages_client_request_id_unique
  on public.whatsapp_messages (client_request_id)
  where client_request_id is not null;
