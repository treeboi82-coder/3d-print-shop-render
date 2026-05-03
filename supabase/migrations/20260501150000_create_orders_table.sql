create extension if not exists "pgcrypto";

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  client_phone text not null,
  print_material text not null,
  payment_method text not null,
  payment_status text not null default 'Unpaid',
  quantity integer not null check (quantity > 0),
  color text,
  country text not null default 'Jordan',
  governorate text not null,
  delivery_address text not null,
  weight_grams numeric(10,2),
  unit_price numeric(10,2),
  total_price numeric(10,2),
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
before update on public.orders
for each row
execute procedure public.set_updated_at();

alter table public.orders enable row level security;

drop policy if exists "Orders are readable by service role only" on public.orders;
create policy "Orders are readable by service role only"
on public.orders
for select
to service_role
using (true);

drop policy if exists "Orders are insertable by service role only" on public.orders;
create policy "Orders are insertable by service role only"
on public.orders
for insert
to service_role
with check (true);

drop policy if exists "Orders are updatable by service role only" on public.orders;
create policy "Orders are updatable by service role only"
on public.orders
for update
to service_role
using (true)
with check (true);
