-- Avera Mobile Mini App: access rules.
-- The Mini App never touches tables directly: it goes through the `api` Edge Function (service_role).
-- Managers sign in with Supabase Auth (public sign-up disabled), so `authenticated` = manager.

alter table public.settings enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.banners enable row level security;
alter table public.customers enable row level security;
alter table public.events enable row level security;
alter table public.orders enable row level security;
alter table public.order_status_history enable row level security;
alter table public.promo_codes enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on public.categories, public.products, public.product_variants, public.banners to authenticated;
grant select, update on public.settings to authenticated;
grant select on public.customers, public.events, public.order_status_history, public.promo_codes, public.orders to authenticated;
grant update (manager_note) on public.orders to authenticated;

create policy managers_all on public.settings for all to authenticated using (true) with check (true);
create policy managers_all on public.categories for all to authenticated using (true) with check (true);
create policy managers_all on public.products for all to authenticated using (true) with check (true);
create policy managers_all on public.product_variants for all to authenticated using (true) with check (true);
create policy managers_all on public.banners for all to authenticated using (true) with check (true);
create policy managers_all on public.customers for all to authenticated using (true) with check (true);
create policy managers_all on public.events for all to authenticated using (true) with check (true);
create policy managers_all on public.orders for all to authenticated using (true) with check (true);
create policy managers_all on public.order_status_history for all to authenticated using (true) with check (true);
create policy managers_all on public.promo_codes for all to authenticated using (true) with check (true);

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.bootstrap_customer(jsonb, text, text), public.track_event(bigint, text, jsonb),
  public.create_order(bigint, jsonb), public.set_order_status(uuid, text, text), public.customer_cancel_order(bigint, uuid),
  public.my_orders(bigint), public.issue_promo(bigint, int, int) to service_role;
grant execute on function public.dashboard(timestamptz, timestamptz, text) to authenticated, service_role;
grant execute on function public.now_tk(), public.tk_local(timestamptz), public.norm_tag(text), public.norm_phone(text),
  public.status_flow(text), public.order_json(public.orders) to authenticated, service_role;
