-- =============================================================================
-- HOLY CAMP · Migração 0006 — Presença dos recrutas e relatório de camisetas
-- -----------------------------------------------------------------------------
-- Rode no SQL Editor do Supabase (projeto sistema_holy), depois da 0005.
-- =============================================================================

begin;

insert into public.permissions (key, name, description, module, sort) values
  ('presenca.marcar', 'Marcar presença', 'Usar a tela de presença dos recrutas (nome, tropa e camiseta; sem dados de saúde).', 'Recrutas', 24),
  ('camisetas.ver', 'Relatório de camisetas', 'Ver e exportar os totais de camisetas e fechar o pedido.', 'Administração', 5)
on conflict (key) do nothing;
insert into public.role_permissions (role_key, permission_key) values
  ('coord_geral', 'presenca.marcar'),
  ('coord_geral', 'camisetas.ver')
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Presença
-- -----------------------------------------------------------------------------

create type public.attendance_status as enum ('pendente', 'presente', 'ausente');

alter table public.encontristas
  add column attendance_status public.attendance_status not null default 'pendente',
  add column attendance_at timestamptz,
  add column attendance_by uuid references public.profiles (id) on delete set null;

create index encontristas_attendance on public.encontristas (camp_id, attendance_status);

-- Lista mostra a presença também.
drop view public.encontristas_list;
create view public.encontristas_list
with (security_invoker = on) as
select
  e.id, e.camp_id, e.status, e.shirt_size, e.created_at, e.person_id,
  p.full_name, p.name_normalized, p.phone, p.birth_date,
  a.group_id, g.name as group_name,
  e.attendance_status, e.attendance_at
from public.encontristas e
join public.people p on p.id = e.person_id
left join public.participant_group_assignments a on a.encontrista_id = e.id
left join public.participant_groups g on g.id = a.group_id;
grant select on public.encontristas_list to authenticated;

create or replace function public.can_mark_attendance()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_perm('presenca.marcar') or public.has_perm('encontristas.editar')
$$;

-- Lista para a tela de presença: só o necessário, nunca saúde. O telefone
-- completo aparece apenas para quem pode ver as fichas.
create or replace function public.attendance_list(p_q text default null, p_group uuid default null, p_status text default null)
returns table (
  id uuid, full_name text, phone text, group_id uuid, group_name text, shirt_size text,
  attendance_status public.attendance_status, attendance_at timestamptz, attendance_by_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_q text := public.normalize_text(coalesce(p_q, ''));
  v_digits text := regexp_replace(coalesce(p_q, ''), '\D', '', 'g');
  v_full boolean := public.has_perm('encontristas.ver');
begin
  if not (public.can_mark_attendance() or v_full) then
    perform public.raise_app_error('SEM_PERMISSAO');
  end if;
  return query
    select e.id, p.full_name,
      case when v_full then p.phone when p.phone is null then null else '••••' || right(p.phone, 4) end,
      a.group_id, g.name, e.shirt_size, e.attendance_status, e.attendance_at, pr.full_name
    from public.encontristas e
    join public.people p on p.id = e.person_id
    left join public.participant_group_assignments a on a.encontrista_id = e.id
    left join public.participant_groups g on g.id = a.group_id
    left join public.profiles pr on pr.id = e.attendance_by
    where e.camp_id = public.active_camp_id() and e.status = 'ativo'
      and (v_q = '' or p.name_normalized like '%' || v_q || '%' or (length(v_digits) >= 4 and p.phone like '%' || v_digits || '%'))
      and (p_group is null or a.group_id = p_group or (p_group = '00000000-0000-0000-0000-000000000000' and a.group_id is null))
      and (p_status is null or e.attendance_status::text = p_status)
    order by p.name_normalized
    limit 2000;
end;
$$;

create or replace function public.attendance_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_camp uuid := public.active_camp_id();
begin
  if not (public.can_mark_attendance() or public.has_perm('encontristas.ver')) then
    perform public.raise_app_error('SEM_PERMISSAO');
  end if;
  return jsonb_build_object(
    'total', (select jsonb_build_object(
        'total', count(*), 'presente', count(*) filter (where attendance_status = 'presente'),
        'ausente', count(*) filter (where attendance_status = 'ausente'), 'pendente', count(*) filter (where attendance_status = 'pendente'))
      from public.encontristas where camp_id = v_camp and status = 'ativo'),
    'groups', coalesce((
      select jsonb_agg(x order by x->>'name')
      from (
        select jsonb_build_object(
          'id', coalesce(g.id::text, '00000000-0000-0000-0000-000000000000'),
          'name', coalesce(g.name, 'Sem tropa'),
          'total', count(*),
          'presente', count(*) filter (where e.attendance_status = 'presente'),
          'ausente', count(*) filter (where e.attendance_status = 'ausente'),
          'pendente', count(*) filter (where e.attendance_status = 'pendente')) x
        from public.encontristas e
        left join public.participant_group_assignments a on a.encontrista_id = e.id
        left join public.participant_groups g on g.id = a.group_id
        where e.camp_id = v_camp and e.status = 'ativo'
        group by g.id, g.name
      ) t
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.set_attendance(p_id uuid, p_status public.attendance_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_e public.encontristas;
begin
  if not public.can_mark_attendance() then
    perform public.raise_app_error('SEM_PERMISSAO');
  end if;
  select * into v_e from public.encontristas where id = p_id for update;
  if v_e.id is null or v_e.status <> 'ativo' then
    perform public.raise_app_error('NAO_ENCONTRADO');
  end if;
  if not public.camp_is_editable(v_e.camp_id) then
    perform public.raise_app_error('ACAMPAMENTO_FECHADO');
  end if;
  update public.encontristas set
    attendance_status = p_status,
    attendance_at = case when p_status = 'pendente' then null else now() end,
    attendance_by = case when p_status = 'pendente' then null else auth.uid() end
  where id = p_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Camisetas
-- -----------------------------------------------------------------------------

-- Lista nominal das camisetas válidas: inscrições ativas de soldados/servos e
-- fichas ativas de recrutas (cada pessoa conta uma vez por inscrição).
create or replace function public.shirt_list()
returns table (kind text, person text, shirt_size text, team_or_group text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_camp uuid := public.active_camp_id();
begin
  if not public.has_perm('camisetas.ver') then
    perform public.raise_app_error('SEM_PERMISSAO');
  end if;
  return query
    select 'Soldado/servo'::text, p.full_name, m.shirt_size, t.name
    from public.service_team_memberships m
    join public.people p on p.id = m.person_id
    join public.service_teams t on t.id = m.team_id
    where m.camp_id = v_camp and m.status = 'ativa'
    union all
    select 'Recruta'::text, p.full_name, e.shirt_size, coalesce(g.name, 'Sem tropa')
    from public.encontristas e
    join public.people p on p.id = e.person_id
    left join public.participant_group_assignments a on a.encontrista_id = e.id
    left join public.participant_groups g on g.id = a.group_id
    where e.camp_id = v_camp and e.status = 'ativo'
    order by 1, 2;
end;
$$;

-- Pedidos fechados: cada fechamento vira uma versão, sem apagar as anteriores.
create table public.shirt_orders (
  id          uuid primary key default gen_random_uuid(),
  camp_id     uuid not null references public.camps (id) on delete restrict,
  version     int not null,
  totals      jsonb not null,
  rows        jsonb not null,
  note        text check (note is null or char_length(note) <= 500),
  created_at  timestamptz not null default now(),
  created_by  uuid references public.profiles (id) on delete set null,
  unique (camp_id, version)
);
alter table public.shirt_orders enable row level security;
create policy shirt_orders_select on public.shirt_orders for select to authenticated
  using (public.has_perm('camisetas.ver'));
revoke all on public.shirt_orders from anon, authenticated;
grant select on public.shirt_orders to authenticated;
create trigger audit_shirt_orders after insert or update or delete on public.shirt_orders
  for each row execute function public.tg_audit('id');

create or replace function public.close_shirt_order(p_note text default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_camp uuid := public.active_camp_id();
  v_rows jsonb;
  v_totals jsonb;
  v_version int;
begin
  if not public.has_perm('camisetas.ver') then
    perform public.raise_app_error('SEM_PERMISSAO');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'person', person, 'size', shirt_size, 'where', team_or_group)), '[]'::jsonb)
    into v_rows from public.shirt_list();
  select coalesce(jsonb_object_agg(coalesce(s, 'Sem tamanho'), c), '{}'::jsonb) into v_totals
    from (select r->>'size' s, count(*) c from jsonb_array_elements(v_rows) r group by 1) x;
  perform 1 from public.camps where id = v_camp for update;
  select coalesce(max(version), 0) + 1 into v_version from public.shirt_orders where camp_id = v_camp;
  insert into public.shirt_orders (camp_id, version, totals, rows, note, created_by)
  values (v_camp, v_version, v_totals, v_rows, nullif(left(trim(coalesce(p_note, '')), 500), ''), auth.uid());
  return v_version;
end;
$$;

revoke execute on function
  public.can_mark_attendance(), public.attendance_list(text, uuid, text), public.attendance_summary(),
  public.set_attendance(uuid, public.attendance_status), public.shirt_list(), public.close_shirt_order(text)
from public, anon;
grant execute on function
  public.can_mark_attendance(), public.attendance_list(text, uuid, text), public.attendance_summary(),
  public.set_attendance(uuid, public.attendance_status), public.shirt_list(), public.close_shirt_order(text)
to authenticated;

commit;
