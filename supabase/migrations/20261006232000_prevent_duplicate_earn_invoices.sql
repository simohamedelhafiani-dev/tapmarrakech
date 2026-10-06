create unique index if not exists loyalty_transactions_unique_earn_invoice_per_establishment
on public.loyalty_transactions (establishment_id, lower(btrim(invoice_number)))
where type = 'EARN'
  and invoice_number is not null
  and btrim(invoice_number) <> '';
