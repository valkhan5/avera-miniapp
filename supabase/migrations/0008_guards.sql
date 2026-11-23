-- Guards against acting on stale screens:
-- * a group button carries the status it was drawn for; if the order has moved since, the change is refused;
-- * an order carries the subtotal the customer saw; if prices changed meanwhile, it is refused with PRICE_CHANGED.

drop function public.set_order_status(uuid, text, text);
create function public.set_order_status(p_order_id uuid, p_status text, p_actor text, p_expected text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o orders; v_from text;
begin
  select * into o from orders where id = p_order_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  v_from := o.status;
  if (p_expected is not null and v_from <> p_expected) or v_from in ('done', 'cancelled') or v_from = p_status
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
revoke execute on function public.set_order_status(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.set_order_status(uuid, text, text, text) to service_role;

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

  -- The total the customer confirmed was computed from these prices; refuse if they changed meanwhile.
  if nullif(p->>'expected_subtotal', '') is not null and (p->>'expected_subtotal')::int <> v_subtotal then
    raise exception 'PRICE_CHANGED';
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
