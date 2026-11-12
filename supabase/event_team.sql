-- Equipe do evento no Gate8 Manager.
-- O proprietário continua sendo events.created_by.
-- O convidado só recebe leitura depois de aceitar, e não pode se promover.

create table if not exists public.event_team_members (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  email text not null,
  invitee_name text,
  invited_by uuid not null references auth.users (id),
  role text not null default 'viewer' check (role = 'viewer'),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz
);

create unique index if not exists event_team_members_live_email
  on public.event_team_members (event_id, lower(email))
  where status in ('pending', 'accepted');

create index if not exists event_team_members_user
  on public.event_team_members (user_id, status);

alter table public.event_team_members enable row level security;

create or replace function public.event_team_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
begin
  select created_by into owner_id from public.events where id = old.event_id;
  if new.event_id is distinct from old.event_id
     or new.invited_by is distinct from old.invited_by
     or lower(new.email) is distinct from lower(old.email)
     or new.role is distinct from 'viewer' then
    raise exception 'Convite inválido';
  end if;

  if auth.uid() = owner_id then
    if new.status not in ('pending', 'accepted', 'revoked') then
      raise exception 'Status inválido';
    end if;
    if old.status = 'pending' and new.status = 'accepted' then
      raise exception 'Quem aceita o convite é o convidado';
    end if;
    return new;
  end if;

  if old.status is distinct from 'pending'
     or new.status is distinct from 'accepted'
     or new.user_id is distinct from auth.uid()
     or new.role is distinct from 'viewer' then
    raise exception 'Sem permissão para alterar este convite';
  end if;
  if old.user_id is not null and old.user_id is distinct from auth.uid()
     and lower(old.email) is distinct from lower(coalesce(auth.jwt() ->> 'email', '')) then
    raise exception 'Sem permissão para aceitar este convite';
  end if;
  new.accepted_at = now();
  return new;
end;
$$;

drop trigger if exists event_team_guard on public.event_team_members;
create trigger event_team_guard
  before update on public.event_team_members
  for each row execute function public.event_team_guard();

create or replace function public.event_is_owner(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.events
    where id = target and created_by = auth.uid()
  );
$$;

create or replace function public.event_is_viewer(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.event_team_members
    where event_id = target
      and user_id = auth.uid()
      and status = 'accepted'
      and role = 'viewer'
  );
$$;

drop policy if exists event_team_owner_select on public.event_team_members;
create policy event_team_owner_select on public.event_team_members
  for select using (public.event_is_owner(event_id) or user_id = auth.uid() or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists event_team_owner_insert on public.event_team_members;
create policy event_team_owner_insert on public.event_team_members
  for insert with check (
    public.event_is_owner(event_id)
    and invited_by = auth.uid()
    and role = 'viewer'
    and status = 'pending'
  );

drop policy if exists event_team_update on public.event_team_members;
create policy event_team_update on public.event_team_members
  for update using (
    public.event_is_owner(event_id)
    or user_id = auth.uid()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- Leitura extra para quem foi aceito. Só SELECT: as políticas de escrita atuais
-- do proprietário continuam valendo e o membro não ganha insert/update/delete.
do $$
declare
  target text;
  col text;
begin
  foreach target in array array[
    'events', 'ticket_batches', 'tickets', 'purchase_orders', 'withdrawal_requests',
    'event_tables', 'purchase_intents', 'refund_logs', 'ticket_delivery_guests', 'checkins',
    'coupon_redemptions', 'coupon_usages', 'purchase_coupons', 'applied_coupons',
    'event_coupon_uses', 'pos_sale_items'
  ]
  loop
    if to_regclass('public.' || target) is null then
      continue;
    end if;
    col := case when target = 'events' then 'id' else 'event_id' end;
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = target and column_name = col
    ) then
      continue;
    end if;
    execute format('drop policy if exists %I on public.%I', target || '_team_read', target);
    execute format(
      'create policy %I on public.%I for select using (public.event_is_viewer(%I))',
      target || '_team_read',
      target,
      col
    );
  end loop;
end $$;

do $$
begin
  if to_regclass('public.purchase_orders') is not null
     and not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'purchase_orders' and column_name = 'event_id'
     )
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'tickets' and column_name = 'purchase_id'
     ) then
    execute 'drop policy if exists purchase_orders_team_read on public.purchase_orders';
    execute $policy$
      create policy purchase_orders_team_read on public.purchase_orders
      for select using (
        exists (
          select 1 from public.tickets t
          where t.purchase_id = purchase_orders.id
            and public.event_is_viewer(t.event_id)
        )
      )
    $policy$;
  end if;

  if to_regclass('public.pos_sale_items') is not null
     and not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'pos_sale_items' and column_name = 'event_id'
     ) then
    execute 'drop policy if exists pos_sale_items_team_read on public.pos_sale_items';
    execute $policy$
      create policy pos_sale_items_team_read on public.pos_sale_items
      for select using (
        exists (
          select 1 from public.tickets t
          where t.id = pos_sale_items.ticket_id
            and public.event_is_viewer(t.event_id)
        )
      )
    $policy$;
  end if;

  if to_regclass('public.boleto_installments') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'tickets' and column_name = 'purchase_id'
     ) then
    execute 'drop policy if exists boleto_installments_team_read on public.boleto_installments';
    execute $policy$
      create policy boleto_installments_team_read on public.boleto_installments
      for select using (
        exists (
          select 1 from public.tickets t
          where t.purchase_id = boleto_installments.purchase_id
            and public.event_is_viewer(t.event_id)
        )
      )
    $policy$;
  end if;
end $$;

grant select, insert, update on public.event_team_members to authenticated;
grant execute on function public.event_is_owner(uuid) to authenticated;
grant execute on function public.event_is_viewer(uuid) to authenticated;
