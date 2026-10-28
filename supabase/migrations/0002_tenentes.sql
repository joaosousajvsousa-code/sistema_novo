-- =============================================================================
-- HOLY CAMP · Migração 0002 — Tenentes das tropas
-- -----------------------------------------------------------------------------
-- Os líderes das tropas (Tenentes) são escolhidos entre os soldados/servos
-- inscritos na equipe Tenente. Rode este arquivo inteiro no SQL Editor do
-- Supabase, depois da 0001.
-- =============================================================================

begin;

-- Equipe cujos integrantes podem ser tenentes. Se ficar vazio, o sistema usa a
-- equipe cujo nome começa com "Tenente".
alter table public.camps
  add column if not exists leaders_team_id uuid references public.service_teams (id) on delete set null;

grant update (leaders_team_id) on public.camps to authenticated;

create or replace function public.leaders_team_id(p_camp uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select c.leaders_team_id from public.camps c where c.id = p_camp),
    (select t.id from public.service_teams t
      where t.camp_id = p_camp and t.status <> 'inativa' and public.normalize_text(t.name) like 'tenente%'
      order by t.created_at limit 1)
  )
$$;

create table public.participant_group_leaders (
  group_id       uuid not null references public.participant_groups (id) on delete cascade,
  membership_id  uuid not null references public.service_team_memberships (id) on delete cascade,
  created_at     timestamptz not null default now(),
  created_by     uuid references public.profiles (id) on delete set null,
  primary key (group_id, membership_id),
  -- Cada tenente lidera uma tropa só.
  unique (membership_id)
);
create index participant_group_leaders_group on public.participant_group_leaders (group_id);

alter table public.participant_group_leaders enable row level security;
create policy group_leaders_select on public.participant_group_leaders for select to authenticated
  using (public.has_perm('encontristas.ver') or public.has_perm('grupos.gerenciar'));
revoke all on public.participant_group_leaders from anon, authenticated;
grant select on public.participant_group_leaders to authenticated;

create trigger audit_group_leaders after insert or update or delete on public.participant_group_leaders
  for each row execute function public.tg_audit('group_id');

-- Tenentes de todas as tropas (com nome), para quem vê as tropas.
create or replace function public.group_leaders()
returns table (group_id uuid, membership_id uuid, full_name text, phone text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.has_perm('encontristas.ver') or public.has_perm('grupos.gerenciar')) then
    perform public.raise_app_error('SEM_PERMISSAO');
  end if;
  return query
    select l.group_id, l.membership_id, p.full_name, p.phone
    from public.participant_group_leaders l
    join public.participant_groups g on g.id = l.group_id
    join public.service_team_memberships m on m.id = l.membership_id
    join public.people p on p.id = m.person_id
    where g.camp_id = public.active_camp_id()
    order by p.full_name;
end;
$$;

-- Integrantes da equipe Tenente que podem ser escolhidos, e a tropa atual de cada um.
create or replace function public.available_leaders()
returns table (membership_id uuid, full_name text, phone text, group_id uuid, group_name text, team_name text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_team uuid := public.leaders_team_id(public.active_camp_id());
begin
  if not public.has_perm('grupos.gerenciar') then
    perform public.raise_app_error('SEM_PERMISSAO');
  end if;
  return query
    select m.id, p.full_name, p.phone, l.group_id, g.name, t.name
    from public.service_team_memberships m
    join public.people p on p.id = m.person_id
    join public.service_teams t on t.id = m.team_id
    left join public.participant_group_leaders l on l.membership_id = m.id
    left join public.participant_groups g on g.id = l.group_id
    where m.team_id = v_team and m.status = 'ativa'
    order by p.full_name;
end;
$$;

-- Define a lista completa de tenentes de uma tropa (substitui a anterior).
create or replace function public.set_group_leaders(p_group uuid, p_memberships uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.participant_groups;
  v_team uuid;
  v_ids uuid[] := coalesce((select array_agg(distinct x) from unnest(p_memberships) x), array[]::uuid[]);
  v_taken text;
begin
  if not public.has_perm('grupos.gerenciar') then
    perform public.raise_app_error('SEM_PERMISSAO');
  end if;
  select * into v_group from public.participant_groups where id = p_group for update;
  if v_group.id is null then
    perform public.raise_app_error('GRUPO_NAO_ENCONTRADO');
  end if;
  if not public.camp_is_editable(v_group.camp_id) then
    perform public.raise_app_error('ACAMPAMENTO_FECHADO');
  end if;
  v_team := public.leaders_team_id(v_group.camp_id);
  if cardinality(v_ids) > 0 and v_team is null then
    perform public.raise_app_error('SEM_EQUIPE_TENENTE');
  end if;
  if exists (
    select 1 from unnest(v_ids) x(id)
    left join public.service_team_memberships m on m.id = x.id
    where m.id is null or m.team_id <> v_team or m.status <> 'ativa'
  ) then
    perform public.raise_app_error('TENENTE_INVALIDO');
  end if;
  select string_agg(p.full_name || ' (' || g.name || ')', ', ') into v_taken
  from public.participant_group_leaders l
  join public.participant_groups g on g.id = l.group_id
  join public.service_team_memberships m on m.id = l.membership_id
  join public.people p on p.id = m.person_id
  where l.membership_id = any (v_ids) and l.group_id <> p_group;
  if v_taken is not null then
    perform public.raise_app_error('TENENTE_EM_OUTRA_TROPA', v_taken);
  end if;

  delete from public.participant_group_leaders where group_id = p_group and not (membership_id = any (v_ids));
  insert into public.participant_group_leaders (group_id, membership_id, created_by)
  select p_group, x, auth.uid() from unnest(v_ids) x
  on conflict (group_id, membership_id) do nothing;
end;
$$;

-- Tenente cancelado ou transferido para outra equipe deixa a tropa.
create or replace function public.tg_membership_leaves_leadership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.status = 'cancelada' and old.status <> 'cancelada')
     or (new.team_id <> old.team_id and new.team_id is distinct from public.leaders_team_id(new.camp_id)) then
    delete from public.participant_group_leaders where membership_id = new.id;
  end if;
  return new;
end;
$$;
create trigger memberships_leave_leadership after update of status, team_id on public.service_team_memberships
  for each row execute function public.tg_membership_leaves_leadership();

-- Painel: inclui o alerta de tropa sem tenente e a nova nomenclatura.
create or replace function public.dashboard_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_camp public.camps;
  v_all_teams boolean := public.has_perm('servidores.ver_todos') or public.has_perm('equipes.gerenciar');
  v_teams uuid[];
  v_enc boolean := public.has_perm('encontristas.ver');
  v_alerts jsonb := '[]'::jsonb;
  v_result jsonb;
  r record;
begin
  if not public.session_is_valid() then
    perform public.raise_app_error('SEM_PERMISSAO');
  end if;
  select * into v_camp from public.camps where is_active;
  if v_camp.id is null then
    return jsonb_build_object('camp', null);
  end if;

  select coalesce(array_agg(t.id), array[]::uuid[]) into v_teams
  from public.service_teams t
  where t.camp_id = v_camp.id and (v_all_teams or public.is_team_coord(t.id));

  v_result := jsonb_build_object(
    'camp', jsonb_build_object(
      'id', v_camp.id, 'name', v_camp.name, 'status', v_camp.status,
      'start_date', v_camp.start_date, 'end_date', v_camp.end_date, 'location', v_camp.location
    ),
    'scope_all_teams', v_all_teams,
    'teams', (select count(*) from unnest(v_teams)),
    'capacity', coalesce((select sum(capacity) from public.service_teams where id = any (v_teams) and status <> 'inativa'), 0),
    'servidores', (select count(*) from public.service_team_memberships where team_id = any (v_teams) and status = 'ativa'),
    'can_see_encontristas', v_enc
  );

  if v_enc then
    v_result := v_result || jsonb_build_object(
      'encontristas', (select count(*) from public.encontristas where camp_id = v_camp.id and status = 'ativo'),
      'encontristas_sem_grupo', (
        select count(*) from public.encontristas e
        where e.camp_id = v_camp.id and e.status = 'ativo'
          and not exists (select 1 from public.participant_group_assignments a where a.encontrista_id = e.id)
      ),
      'grupos', (select count(*) from public.participant_groups where camp_id = v_camp.id)
    );
  end if;

  -- Alertas: equipes quase cheias ou lotadas
  for r in
    select t.id, t.name, t.capacity, public.team_occupancy(t.id) as occ
    from public.service_teams t
    where t.id = any (v_teams) and t.status <> 'inativa'
  loop
    if r.occ >= r.capacity then
      v_alerts := v_alerts || jsonb_build_object('level', 'info', 'kind', 'equipe_lotada', 'text', 'Equipe ' || r.name || ' está com todas as vagas ocupadas', 'href', '/equipes/' || r.id);
    elsif r.capacity > 0 and r.occ::numeric / r.capacity >= 0.9 then
      v_alerts := v_alerts || jsonb_build_object('level', 'warning', 'kind', 'equipe_quase_cheia', 'text', 'Equipe ' || r.name || ' está perto do limite (' || r.occ || ' de ' || r.capacity || ')', 'href', '/equipes/' || r.id);
    end if;
  end loop;

  if v_all_teams then
    for r in
      select t.id, t.name from public.service_teams t
      where t.camp_id = v_camp.id and t.status <> 'inativa'
        and not exists (select 1 from public.service_team_coordinators c where c.team_id = t.id)
    loop
      v_alerts := v_alerts || jsonb_build_object('level', 'warning', 'kind', 'equipe_sem_coordenador', 'text', 'Equipe ' || r.name || ' não tem coordenador definido', 'href', '/equipes/' || r.id);
    end loop;
  end if;

  if v_enc and (v_result ->> 'encontristas_sem_grupo')::int > 0 then
    v_alerts := v_alerts || jsonb_build_object('level', 'warning', 'kind', 'encontristas_sem_grupo', 'text', (v_result ->> 'encontristas_sem_grupo') || ' recruta(s) ainda sem tropa', 'href', '/grupos/distribuir');
  end if;

  if v_enc and exists (select 1 from public.encontristas where camp_id = v_camp.id and status = 'ativo' and shirt_size is null) then
    v_alerts := v_alerts || jsonb_build_object('level', 'info', 'kind', 'camiseta_sem_tamanho',
      'text', (select count(*) from public.encontristas where camp_id = v_camp.id and status = 'ativo' and shirt_size is null)::text || ' recruta(s) sem tamanho de camiseta',
      'href', '/encontristas?tamanho=sem');
  end if;

  if v_enc then
    for r in
      select g.id, g.name from public.participant_groups g
      where g.camp_id = v_camp.id
        and not exists (select 1 from public.participant_group_leaders l where l.group_id = g.id)
      order by g.name
    loop
      v_alerts := v_alerts || jsonb_build_object('level', 'warning', 'kind', 'tropa_sem_tenente', 'text', 'Tropa ' || r.name || ' ainda não tem tenente', 'href', '/grupos/' || r.id);
    end loop;
  end if;

  return v_result || jsonb_build_object('alerts', v_alerts);
end;
$$;


revoke execute on function public.leaders_team_id(uuid) from public, anon;
revoke execute on function public.group_leaders() from public, anon;
revoke execute on function public.available_leaders() from public, anon;
revoke execute on function public.set_group_leaders(uuid, uuid[]) from public, anon;
grant execute on function
  public.leaders_team_id(uuid),
  public.group_leaders(),
  public.available_leaders(),
  public.set_group_leaders(uuid, uuid[]),
  public.dashboard_summary()
to authenticated;

commit;
