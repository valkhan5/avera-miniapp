-- Avera Mobile Mini App: schema

-- Clock used by all business rules; tests pin it via set_config('app.now', ...).
create or replace function public.now_tk() returns timestamptz language sql stable as $$
  select coalesce(nullif(current_setting('app.now', true), '')::timestamptz, now())
$$;

-- Local Tashkent wall-clock time (fixed UTC+5).
create or replace function public.tk_local(ts timestamptz) returns timestamp language sql immutable as $$
  select (ts at time zone 'UTC') + interval '5 hours'
$$;

create sequence if not exists public.order_number_seq start 1001;

create table public.settings (
  id int primary key default 1 check (id = 1),
  pickup_discount_pct int not null default 10 check (pickup_discount_pct between 0 and 90),
  promo_discount_pct int not null default 5 check (promo_discount_pct between 0 and 90),
  stack_discounts boolean not null default true,
  max_discount_pct int not null default 15 check (max_discount_pct between 0 and 90),
  game_threshold int not null default 300,
  promo_valid_until timestamptz not null default '2026-12-31T23:59:59+05:00',
  delivery_slots text[] not null default array['10:00–14:00', '14:00–18:00', '18:00–22:00'],
  same_day_cutoff_hour int not null default 16 check (same_day_cutoff_hour between 0 and 24),
  last_delivery_date date not null default '2026-12-31',
  pickup_address_uz text not null default '',
  pickup_address_ru text not null default '',
  pickup_hours_uz text not null default '',
  pickup_hours_ru text not null default '',
  pickup_lat double precision,
  pickup_lng double precision,
  contact_promise_uz text not null default 'Menejer siz bilan 15 daqiqa ichida bogʻlanadi (10:00 dan 21:00 gacha)',
  contact_promise_ru text not null default 'Менеджер свяжется с вами в течение 15 минут (с 10:00 до 21:00)',
  bind_code text not null default upper(substr(md5(random()::text), 1, 8)),
  manager_chat_id bigint,
  updated_at timestamptz not null default public.now_tk()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_uz text not null,
  name_ru text not null,
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default public.now_tk()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id),
  slug text not null unique,
  code text not null default '',
  name_uz text not null,
  name_ru text not null,
  audience_uz text not null default '',
  audience_ru text not null default '',
  description_uz text not null default '',
  description_ru text not null default '',
  images text[] not null default '{}',
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default public.now_tk()
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  kind text not null default 'base',
  name_uz text not null,
  name_ru text not null,
  items_uz text[] not null default '{}',
  items_ru text[] not null default '{}',
  price int not null check (price >= 0),
  cost int check (cost is null or cost >= 0),
  stock int check (stock is null or stock >= 0),
  sort int not null default 0,
  active boolean not null default true
);
create index on public.product_variants(product_id);

create table public.banners (
  id uuid primary key default gen_random_uuid(),
  title_uz text not null,
  title_ru text not null,
  text_uz text not null default '',
  text_ru text not null default '',
  image_url text,
  style text not null default 'dark' check (style in ('dark', 'beige', 'light')),
  action text not null default 'none' check (action in ('none', 'product', 'category', 'game')),
  action_value text,
  sort int not null default 0,
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  tg_user_id bigint not null unique,
  username text,
  first_name text,
  last_name text,
  language_code text,
  phone text,
  first_tag text,
  last_tag text,
  best_score int not null default 0,
  notify_allowed boolean not null default false,
  first_seen_at timestamptz not null default public.now_tk(),
  last_seen_at timestamptz not null default public.now_tk()
);

create table public.events (
  id bigserial primary key,
  customer_id uuid not null references public.customers(id) on delete cascade,
  type text not null,
  tag text,
  payload jsonb not null default '{}',
  created_at timestamptz not null default public.now_tk()
);
create index on public.events(type, created_at);
create index on public.events(customer_id);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('AV-' || nextval('public.order_number_seq')),
  client_token uuid not null unique,
  customer_id uuid not null references public.customers(id),
  status text not null default 'new' check (status in ('new', 'confirmed', 'packing', 'on_the_way', 'ready', 'done', 'cancelled')),
  fulfillment text not null check (fulfillment in ('delivery', 'pickup')),
  items jsonb not null,
  subtotal int not null,
  pickup_discount int not null default 0,
  promo_discount int not null default 0,
  applied_pct int not null default 0,
  total int not null,
  promo_code text,
  contact_name text not null,
  contact_phone text not null,
  recipient text,
  card_text text,
  address_text text,
  landmark text,
  lat double precision,
  lng double precision,
  out_of_city boolean not null default false,
  delivery_date date not null,
  delivery_slot text,
  comment text,
  tag text,
  first_tag text,
  manager_note text not null default '',
  group_message_id bigint,
  notify_allowed boolean not null default false,
  created_at timestamptz not null default public.now_tk(),
  updated_at timestamptz not null default public.now_tk()
);
create index on public.orders(customer_id);
create index on public.orders(created_at);
create index on public.orders(status);

create table public.order_status_history (
  id bigserial primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  actor text not null,
  created_at timestamptz not null default public.now_tk()
);
create index on public.order_status_history(order_id);

create table public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  customer_id uuid not null unique references public.customers(id) on delete cascade,
  pct int not null,
  valid_until timestamptz not null,
  used_order_id uuid references public.orders(id),
  created_at timestamptz not null default public.now_tk()
);
