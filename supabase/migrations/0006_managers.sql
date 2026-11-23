-- Only e-mails on the managers list get admin access, even if someone signs up to the Supabase project.
create table public.managers (
  email text primary key,
  created_at timestamptz not null default public.now_tk()
);
alter table public.managers enable row level security;

create or replace function public.is_manager() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.managers m where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
$$;
revoke execute on function public.is_manager() from public, anon;
grant execute on function public.is_manager() to authenticated, service_role;
grant select, insert, delete on public.managers to authenticated;
grant all on public.managers to service_role;

drop policy managers_all on public.settings;
drop policy managers_all on public.categories;
drop policy managers_all on public.products;
drop policy managers_all on public.product_variants;
drop policy managers_all on public.banners;
drop policy managers_all on public.customers;
drop policy managers_all on public.events;
drop policy managers_all on public.orders;
drop policy managers_all on public.order_status_history;
drop policy managers_all on public.promo_codes;
create policy managers_all on public.settings for all to authenticated using (public.is_manager()) with check (public.is_manager());
create policy managers_all on public.categories for all to authenticated using (public.is_manager()) with check (public.is_manager());
create policy managers_all on public.products for all to authenticated using (public.is_manager()) with check (public.is_manager());
create policy managers_all on public.product_variants for all to authenticated using (public.is_manager()) with check (public.is_manager());
create policy managers_all on public.banners for all to authenticated using (public.is_manager()) with check (public.is_manager());
create policy managers_all on public.customers for all to authenticated using (public.is_manager()) with check (public.is_manager());
create policy managers_all on public.events for all to authenticated using (public.is_manager()) with check (public.is_manager());
create policy managers_all on public.orders for all to authenticated using (public.is_manager()) with check (public.is_manager());
create policy managers_all on public.order_status_history for all to authenticated using (public.is_manager()) with check (public.is_manager());
create policy managers_all on public.promo_codes for all to authenticated using (public.is_manager()) with check (public.is_manager());
create policy managers_all on public.managers for all to authenticated using (public.is_manager()) with check (public.is_manager());

alter function public.dashboard(timestamptz, timestamptz, text) rename to dashboard_impl;
revoke execute on function public.dashboard_impl(timestamptz, timestamptz, text) from public, anon, authenticated;
create function public.dashboard(p_from timestamptz, p_to timestamptz, p_attr text default 'last')
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_manager() then raise exception 'FORBIDDEN'; end if;
  return public.dashboard_impl(p_from, p_to, p_attr);
end $$;
revoke execute on function public.dashboard(timestamptz, timestamptz, text) from public, anon;
grant execute on function public.dashboard(timestamptz, timestamptz, text) to authenticated, service_role;

alter function public.now_tk() set search_path = public;
alter function public.tk_local(timestamptz) set search_path = public;
alter function public.norm_tag(text) set search_path = public;
alter function public.norm_phone(text) set search_path = public;
alter function public.status_flow(text) set search_path = public;
alter function public.order_json(public.orders) set search_path = public;
