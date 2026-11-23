-- Avera Mobile Mini App: business functions (single source of truth for pricing, stock, promo, statuses)

create or replace function public.norm_tag(raw text) returns text language sql immutable as $$
  select case when lower(trim(raw)) ~ '^[a-z0-9_]{1,64}$' then lower(trim(raw)) else null end
$$;

create or replace function public.norm_phone(raw text) returns text language plpgsql immutable as $$
declare d text := regexp_replace(coalesce(raw, ''), '\D', '', 'g');
begin
  if length(d) = 12 and left(d, 3) = '998' then d := substr(d, 4); end if;
  if d ~ '^\d{9}$' then return '+998' || d; end if;
  return null;
end $$;

create or replace function public.status_flow(f text) returns text[] language sql immutable as $$
  select array['new', 'confirmed', 'packing', case when f = 'pickup' then 'ready' else 'on_the_way' end, 'done']
$$;

-- Order as JSON plus the customer fields notifications need.
create or replace function public.order_json(o public.orders) returns jsonb language sql stable as $$
  select to_jsonb(o) || jsonb_build_object('customer', jsonb_build_object(
    'tg_user_id', c.tg_user_id, 'username', c.username, 'first_name', c.first_name,
    'lang', case when c.language_code = 'ru' then 'ru' else 'uz' end))
  from public.customers c where c.id = o.customer_id
$$;

create or replace function public.bootstrap_customer(p_user jsonb, p_tag text, p_event text default 'app_open')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c customers;
  v_tag text := norm_tag(p_tag);
  v_promo jsonb;
begin
  insert into customers (tg_user_id, username, first_name, last_name, language_code, first_tag, last_tag)
  values ((p_user->>'id')::bigint, p_user->>'username', p_user->>'first_name', p_user->>'last_name', p_user->>'language_code', v_tag, v_tag)
  on conflict (tg_user_id) do update set
    username = excluded.username, first_name = excluded.first_name, last_name = excluded.last_name,
    language_code = excluded.language_code, last_seen_at = now_tk(),
    first_tag = coalesce(customers.first_tag, excluded.first_tag),
    last_tag = coalesce(excluded.last_tag, customers.last_tag)
  returning * into c;

  insert into events (customer_id, type, tag) values (c.id, coalesce(p_event, 'app_open'), v_tag);

  select jsonb_build_object('code', code, 'pct', pct, 'valid_until', valid_until) into v_promo
  from promo_codes where customer_id = c.id and used_order_id is null and valid_until >= now_tk();

  return jsonb_build_object('customer', to_jsonb(c), 'promo', v_promo);
end $$;

create or replace function public.track_event(p_tg_user_id bigint, p_type text, p_payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_customer uuid;
begin
  if p_type not in ('product_view', 'add_to_cart', 'checkout_open', 'game_start', 'game_finish') then
    raise exception 'BAD_EVENT';
  end if;
  select id into v_customer from customers where tg_user_id = p_tg_user_id;
  if v_customer is null then raise exception 'NO_CUSTOMER'; end if;
  insert into events (customer_id, type, payload) values (v_customer, p_type, coalesce(p_payload, '{}'));
end $$;

create or replace function public.create_order(p_tg_user_id bigint, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c customers;
  s settings;
  o orders;
  v_existing orders;
  v_promo promo_codes;
  r record;
  v_lines jsonb := '[]';
  v_subtotal int := 0;
  v_phone text;
  v_f text := p->>'fulfillment';
  v_date date;
  v_today date;
  v_min_date date;
  v_pickup_pct int; v_promo_pct int; v_pct int; v_total int; v_disc int; v_pickup_disc int;
  v_lat double precision := nullif(p->>'lat', '')::double precision;
  v_lng double precision := nullif(p->>'lng', '')::double precision;
begin
  select * into c from customers where tg_user_id = p_tg_user_id;
  if not found then raise exception 'NO_CUSTOMER'; end if;

  select * into v_existing from orders where client_token = (p->>'client_token')::uuid;
  if found then
    if v_existing.customer_id <> c.id then raise exception 'BAD_TOKEN'; end if;
    return order_json(v_existing);
  end if;

  select * into s from settings where id = 1;

  if (select count(*) from orders where customer_id = c.id and created_at > now_tk() - interval '1 hour') >= 5 then
    raise exception 'RATE_LIMIT';
  end if;

  if jsonb_typeof(p->'items') <> 'array' or jsonb_array_length(p->'items') = 0 then raise exception 'EMPTY_CART'; end if;

  for r in
    select x.variant_id, sum(x.qty)::int as qty
    from jsonb_to_recordset(p->'items') as x(variant_id uuid, qty int)
    group by x.variant_id
  loop
    if r.qty is null or r.qty < 1 or r.qty > 20 then raise exception 'BAD_QTY'; end if;
  end loop;

  for r in
    select x.qty, v.id as variant_id, v.price, v.cost, v.stock, v.active as v_active, v.name_uz as v_uz, v.name_ru as v_ru,
           pr.id as product_id, pr.slug, pr.name_uz as p_uz, pr.name_ru as p_ru, pr.active as p_active, cat.active as c_active
    from (select variant_id, sum(qty)::int as qty from jsonb_to_recordset(p->'items') as y(variant_id uuid, qty int) group by variant_id) x
    join product_variants v on v.id = x.variant_id
    join products pr on pr.id = v.product_id
    join categories cat on cat.id = pr.category_id
    for update of v
  loop
    if not r.v_active or not r.p_active or not r.c_active then raise exception 'UNAVAILABLE'; end if;
    if r.stock is not null and r.stock < r.qty then raise exception 'OUT_OF_STOCK'; end if;
    v_lines := v_lines || jsonb_build_object('variant_id', r.variant_id, 'product_id', r.product_id, 'slug', r.slug,
      'product_name_uz', r.p_uz, 'product_name_ru', r.p_ru, 'variant_name_uz', r.v_uz, 'variant_name_ru', r.v_ru,
      'price', r.price, 'cost', r.cost, 'qty', r.qty);
    v_subtotal := v_subtotal + r.price * r.qty;
  end loop;

  if jsonb_array_length(v_lines) < (select count(distinct (e->>'variant_id')) from jsonb_array_elements(p->'items') e) then
    raise exception 'UNAVAILABLE';
  end if;

  if coalesce(trim(p->>'contact_name'), '') = '' then raise exception 'NEED_NAME'; end if;
  v_phone := norm_phone(p->>'contact_phone');
  if v_phone is null then raise exception 'BAD_PHONE'; end if;
  if length(coalesce(p->>'card_text', '')) > 200 then raise exception 'CARD_TOO_LONG'; end if;

  if v_f is null or v_f not in ('delivery', 'pickup') then raise exception 'BAD_FULFILLMENT'; end if;
  if v_f = 'delivery' then
    if v_lat is null or v_lng is null then raise exception 'NEED_LOCATION'; end if;
    if coalesce(trim(p->>'address_text'), '') = '' then raise exception 'NEED_ADDRESS'; end if;
    if not ((p->>'delivery_slot') = any (s.delivery_slots)) then raise exception 'BAD_SLOT'; end if;
  end if;

  v_today := tk_local(now_tk())::date;
  v_min_date := case when extract(hour from tk_local(now_tk())) < s.same_day_cutoff_hour then v_today else v_today + 1 end;
  v_date := nullif(p->>'delivery_date', '')::date;
  if v_date is null or v_date < v_min_date or v_date > s.last_delivery_date then raise exception 'BAD_DATE'; end if;

  if coalesce(trim(p->>'promo_code'), '') <> '' then
    select * into v_promo from promo_codes
    where code = upper(trim(p->>'promo_code')) and customer_id = c.id and used_order_id is null and valid_until >= now_tk()
    for update;
    if not found then raise exception 'BAD_PROMO'; end if;
  end if;

  v_pickup_pct := case when v_f = 'pickup' then s.pickup_discount_pct else 0 end;
  v_promo_pct := case when v_promo.id is not null then s.promo_discount_pct else 0 end;
  v_pct := case when s.stack_discounts then v_pickup_pct + v_promo_pct else greatest(v_pickup_pct, v_promo_pct) end;
  v_pct := least(v_pct, s.max_discount_pct);
  v_total := (floor(v_subtotal::numeric * (100 - v_pct) / 100 / 1000) * 1000)::int;
  v_disc := v_subtotal - v_total;
  v_pickup_disc := least(v_disc, round(v_subtotal::numeric * least(
    case when s.stack_discounts or v_pickup_pct >= v_promo_pct then v_pickup_pct else 0 end, v_pct) / 100)::int);

  update product_variants pv set stock = pv.stock - l.qty
  from (select (e->>'variant_id')::uuid as id, (e->>'qty')::int as qty from jsonb_array_elements(v_lines) e) l
  where pv.id = l.id and pv.stock is not null;

  insert into orders (client_token, customer_id, fulfillment, items, subtotal, pickup_discount, promo_discount, applied_pct, total,
    promo_code, contact_name, contact_phone, recipient, card_text, address_text, landmark, lat, lng, out_of_city,
    delivery_date, delivery_slot, comment, tag, first_tag, notify_allowed)
  values ((p->>'client_token')::uuid, c.id, v_f, v_lines, v_subtotal, v_pickup_disc, v_disc - v_pickup_disc, v_pct, v_total,
    v_promo.code, trim(p->>'contact_name'), v_phone, nullif(p->>'recipient', ''), nullif(p->>'card_text', ''),
    case when v_f = 'delivery' then trim(p->>'address_text') end, case when v_f = 'delivery' then nullif(trim(p->>'landmark'), '') end,
    case when v_f = 'delivery' then v_lat end, case when v_f = 'delivery' then v_lng end,
    v_f = 'delivery' and not (v_lat between 41.17 and 41.45 and v_lng between 69.12 and 69.47),
    v_date, case when v_f = 'delivery' then p->>'delivery_slot' end, nullif(trim(p->>'comment'), ''),
    coalesce(norm_tag(p->>'tag'), c.last_tag), c.first_tag, coalesce((p->>'notify_allowed')::boolean, false))
  returning * into o;

  if v_promo.id is not null then update promo_codes set used_order_id = o.id where id = v_promo.id; end if;
  insert into order_status_history (order_id, from_status, to_status, actor) values (o.id, null, 'new', 'customer');
  insert into events (customer_id, type, tag, payload) values (c.id, 'order_created', o.tag, jsonb_build_object('order_id', o.id));
  update customers set phone = v_phone, notify_allowed = notify_allowed or o.notify_allowed where id = c.id;

  return order_json(o);
end $$;

create or replace function public.set_order_status(p_order_id uuid, p_status text, p_actor text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o orders; v_from text;
begin
  select * into o from orders where id = p_order_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  v_from := o.status;
  if v_from in ('done', 'cancelled') or v_from = p_status
     or (p_status <> 'cancelled' and not (p_status = any (status_flow(o.fulfillment)))) then
    raise exception 'BAD_TRANSITION';
  end if;

  if p_status = 'cancelled' then
    update product_variants pv set stock = pv.stock + l.qty
    from (select (e->>'variant_id')::uuid as id, (e->>'qty')::int as qty from jsonb_array_elements(o.items) e) l
    where pv.id = l.id and pv.stock is not null;
    update promo_codes set used_order_id = null where used_order_id = o.id;
  end if;

  update orders set status = p_status, updated_at = now_tk() where id = o.id returning * into o;
  insert into order_status_history (order_id, from_status, to_status, actor) values (o.id, v_from, p_status, coalesce(p_actor, 'system'));
  return order_json(o);
end $$;

create or replace function public.customer_cancel_order(p_tg_user_id bigint, p_order_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  select o2.* into o from orders o2 join customers c on c.id = o2.customer_id
  where o2.id = p_order_id and c.tg_user_id = p_tg_user_id;
  if not found or o.status <> 'new' then raise exception 'CANNOT_CANCEL'; end if;
  return set_order_status(p_order_id, 'cancelled', 'customer');
end $$;

create or replace function public.my_orders(p_tg_user_id bigint)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(o) - 'manager_note' - 'group_message_id' || jsonb_build_object('history',
    (select coalesce(jsonb_agg(jsonb_build_object('status', h.to_status, 'at', h.created_at) order by h.id), '[]')
     from order_status_history h where h.order_id = o.id)) order by o.created_at desc), '[]')
  from orders o join customers c on c.id = o.customer_id
  where c.tg_user_id = p_tg_user_id
$$;

create or replace function public.issue_promo(p_tg_user_id bigint, p_score int, p_duration_ms int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c customers; s settings; v_promo promo_codes; v_code text; v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i int;
begin
  if p_duration_ms is null or p_duration_ms < 55000 or p_duration_ms > 75000
     or p_score is null or p_score < 0 or p_score > p_duration_ms / 1000.0 * 80 then
    raise exception 'BAD_SCORE';
  end if;
  select * into s from settings where id = 1;
  update customers set best_score = greatest(best_score, p_score) where tg_user_id = p_tg_user_id returning * into c;
  if not found then raise exception 'NO_CUSTOMER'; end if;
  insert into events (customer_id, type, payload) values (c.id, 'game_finish', jsonb_build_object('score', p_score));

  select * into v_promo from promo_codes where customer_id = c.id;
  if not found and p_score >= s.game_threshold and now_tk() <= s.promo_valid_until then
    loop
      v_code := 'ELF-';
      for i in 1..6 loop v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1); end loop;
      begin
        insert into promo_codes (code, customer_id, pct, valid_until) values (v_code, c.id, s.promo_discount_pct, s.promo_valid_until)
        returning * into v_promo;
        exit;
      exception when unique_violation then
        if exists (select 1 from promo_codes where customer_id = c.id) then
          select * into v_promo from promo_codes where customer_id = c.id; exit;
        end if;
      end;
    end loop;
  end if;

  return jsonb_build_object('best_score', c.best_score, 'threshold', s.game_threshold,
    'promo', case when v_promo.id is null then null else jsonb_build_object('code', v_promo.code, 'pct', v_promo.pct,
      'valid_until', v_promo.valid_until, 'used', v_promo.used_order_id is not null) end);
end $$;

create or replace function public.dashboard(p_from timestamptz, p_to timestamptz, p_attr text default 'last')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_kpi jsonb; v_by_day jsonb; v_by_status jsonb; v_by_product jsonb; v_by_tag jsonb; v_funnel jsonb;
  v_leads int; v_warm int; v_cart int; v_requests int; v_orders int; v_sales int; v_revenue bigint; v_cost bigint;
begin
  select count(distinct customer_id) into v_leads from events where type = 'app_open' and created_at >= p_from and created_at < p_to;
  select count(distinct customer_id) into v_cart from events where type = 'add_to_cart' and created_at >= p_from and created_at < p_to;
  select count(distinct customer_id) into v_warm from events where type in ('add_to_cart', 'game_start', 'game_finish') and created_at >= p_from and created_at < p_to;
  select count(*), count(*) filter (where status not in ('new', 'cancelled')), count(*) filter (where status = 'done'),
         coalesce(sum(total) filter (where status = 'done'), 0)
    into v_requests, v_orders, v_sales, v_revenue
  from orders where created_at >= p_from and created_at < p_to;
  select coalesce(sum(coalesce((e->>'cost')::bigint, 0) * (e->>'qty')::int), 0) into v_cost
  from orders o, jsonb_array_elements(o.items) e where o.status = 'done' and o.created_at >= p_from and o.created_at < p_to;

  v_kpi := jsonb_build_object(
    'leads', v_leads, 'warm_leads', v_warm, 'requests', v_requests, 'orders', v_orders, 'sales', v_sales,
    'revenue', v_revenue, 'avg_check', case when v_sales > 0 then round(v_revenue::numeric / v_sales) else 0 end,
    'gross_profit', v_revenue - v_cost,
    'players', (select count(distinct customer_id) from events where type = 'game_finish' and created_at >= p_from and created_at < p_to),
    'promos_issued', (select count(*) from promo_codes where created_at >= p_from and created_at < p_to),
    'promos_used', (select count(*) from promo_codes pc join orders o on o.id = pc.used_order_id where o.created_at >= p_from and o.created_at < p_to));

  select coalesce(jsonb_agg(jsonb_build_object('day', d::date,
    'requests', (select count(*) from orders o where tk_local(o.created_at)::date = d::date),
    'sales', (select count(*) from orders o where o.status = 'done' and tk_local(o.created_at)::date = d::date)) order by d), '[]')
  into v_by_day
  from generate_series(tk_local(p_from)::date, (tk_local(p_to) - interval '1 second')::date, interval '1 day') d;

  select coalesce(jsonb_agg(jsonb_build_object('status', status, 'n', n) order by n desc), '[]') into v_by_status
  from (select status, count(*) n from orders where created_at >= p_from and created_at < p_to group by status) t;

  select coalesce(jsonb_agg(jsonb_build_object('name', name, 'qty', qty, 'amount', amount) order by qty desc), '[]') into v_by_product
  from (select e->>'product_name_ru' as name, sum((e->>'qty')::int) qty, sum((e->>'qty')::int * (e->>'price')::bigint) amount
        from orders o, jsonb_array_elements(o.items) e
        where o.status = 'done' and o.created_at >= p_from and o.created_at < p_to group by 1) t;

  with lead_tags as (
    select case when p_attr = 'first' then c.first_tag else ev.tag end as tag, count(distinct ev.customer_id) leads
    from events ev join customers c on c.id = ev.customer_id
    where ev.type = 'app_open' and ev.created_at >= p_from and ev.created_at < p_to
    group by 1),
  order_tags as (
    select case when p_attr = 'first' then first_tag else tag end as tag, count(*) requests,
           count(*) filter (where status = 'done') sales, coalesce(sum(total) filter (where status = 'done'), 0) revenue
    from orders where created_at >= p_from and created_at < p_to group by 1)
  select coalesce(jsonb_agg(jsonb_build_object('tag', coalesce(t, '(без метки)'), 'leads', coalesce(l.leads, 0),
    'requests', coalesce(ot.requests, 0), 'sales', coalesce(ot.sales, 0), 'revenue', coalesce(ot.revenue, 0))
    order by coalesce(ot.requests, 0) desc, coalesce(l.leads, 0) desc), '[]')
  into v_by_tag
  from (select tag as t from lead_tags union select tag from order_tags) tags
  left join lead_tags l on l.tag is not distinct from tags.t
  left join order_tags ot on ot.tag is not distinct from tags.t;

  v_funnel := jsonb_build_array(
    jsonb_build_object('step', 'opened', 'n', v_leads), jsonb_build_object('step', 'cart', 'n', v_cart),
    jsonb_build_object('step', 'requests', 'n', v_requests), jsonb_build_object('step', 'orders', 'n', v_orders),
    jsonb_build_object('step', 'sales', 'n', v_sales));

  return jsonb_build_object('kpi', v_kpi, 'by_day', v_by_day, 'by_status', v_by_status, 'by_product', v_by_product,
    'by_tag', v_by_tag, 'funnel', v_funnel);
end $$;
