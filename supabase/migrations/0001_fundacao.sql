-- =============================================================================
-- ACAMPA · Migração 0001 — Fundação (Fase 1)
-- -----------------------------------------------------------------------------
-- Usuários, perfis e permissões · Acampamento · Equipes de serviço ·
-- Inscrições de servidores (com controle de vagas seguro) · Encontristas ·
-- Saúde (acesso restrito e auditado) · Grupos e distribuição · Auditoria.
--
-- Rode este arquivo inteiro no SQL Editor de um projeto Supabase NOVO,
-- exclusivo para o Acampa.
-- =============================================================================

begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists citext   with schema extensions;

-- -----------------------------------------------------------------------------
-- Utilitários
-- -----------------------------------------------------------------------------

create or replace function public.normalize_text(t text)
returns text
language sql
immutable
parallel safe
set search_path = public, extensions
as $$
  select lower(regexp_replace(trim(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t, ''))), '\s+', ' ', 'g'))
$$;

create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Erros de negócio padronizados: a aplicação traduz o código em mensagem.
create or replace function public.raise_app_error(code text, detail text default null)
returns void
language plpgsql
as $$
begin
  raise exception 'ACAMPA:%', code using errcode = 'P0001', detail = coalesce(detail, '');
end;
$$;

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------

create type public.camp_status as enum ('planejamento', 'inscricoes_abertas', 'em_andamento', 'encerrado', 'arquivado');
create type public.team_status as enum ('aberta', 'fechada', 'inativa');
create type public.membership_status as enum ('ativa', 'cancelada');
create type public.payment_status as enum ('pendente', 'comprovante_enviado', 'em_analise', 'confirmado', 'isento', 'cancelado', 'estornado');
create type public.encontrista_status as enum ('ativo', 'cancelado');
create type public.health_info_status as enum ('nao_informado', 'nao_possui', 'possui');

-- -----------------------------------------------------------------------------
-- Usuários, papéis e permissões
-- -----------------------------------------------------------------------------

create table public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  username              extensions.citext not null unique
                          check (username::text ~ '^[a-z0-9][a-z0-9._-]{2,31}$'),
  full_name             text not null check (char_length(trim(full_name)) between 2 and 120),
  phone                 text check (phone is null or phone ~ '^[0-9]{10,11}$'),
  active                boolean not null default true,
  must_change_password  boolean not null default true,
  sessions_revoked_at   timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            uuid references public.profiles (id) on delete set null
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.tg_set_updated_at();

create table public.roles (
  key          text primary key,
  name         text not null,
  description  text not null,
  sort         int not null default 0
);

create table public.permissions (
  key          text primary key,
  name         text not null,
  description  text not null,
  module       text not null,
  sort         int not null default 0
);

create table public.role_permissions (
  role_key        text not null references public.roles (key) on delete cascade,
  permission_key  text not null references public.permissions (key) on delete cascade,
  primary key (role_key, permission_key)
);

create table public.user_roles (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role_key    text not null references public.roles (key) on delete restrict,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.profiles (id) on delete set null,
  primary key (user_id, role_key)
);

-- Permissões concedidas individualmente (ex.: saúde, financeiro).
create table public.user_permissions (
  user_id         uuid not null references public.profiles (id) on delete cascade,
  permission_key  text not null references public.permissions (key) on delete cascade,
  created_at      timestamptz not null default now(),
  created_by      uuid references public.profiles (id) on delete set null,
  primary key (user_id, permission_key)
);

insert into public.roles (key, name, description, sort) values
  ('admin',        'Administrador do sistema', 'Acesso total: usuários, permissões, configurações e auditoria.', 1),
  ('coord_geral',  'Coordenador geral',        'Gerencia equipes, servidores, encontristas e grupos. Financeiro só com permissão explícita.', 2),
  ('coord_equipe', 'Coordenador de equipe',    'Acessa apenas as equipes de serviço que coordena.', 3),
  ('voluntario',   'Voluntário',               'Acesso limitado. Recebe permissões específicas quando necessário.', 4);

insert into public.permissions (key, name, description, module, sort) values
  ('usuarios.gerenciar',      'Gerenciar usuários',            'Criar, editar e desativar usuários e atribuir permissões.', 'Administração', 1),
  ('acampamento.gerenciar',   'Configurar o acampamento',      'Editar dados, status e configurações do acampamento ativo.', 'Administração', 2),
  ('auditoria.ver',           'Consultar auditoria',           'Ver o registro de operações sensíveis.',                   'Administração', 3),
  ('equipes.gerenciar',       'Gerenciar equipes de serviço',  'Criar equipes, definir coordenadores, vagas e inscrições.', 'Equipes', 10),
  ('servidores.ver_todos',    'Ver todos os servidores',       'Consultar servidores de todas as equipes.',                'Equipes', 11),
  ('servidores.editar_todos', 'Editar todos os servidores',    'Cadastrar e editar servidores de qualquer equipe.',        'Equipes', 12),
  ('encontristas.ver',        'Ver encontristas',              'Consultar a lista e as fichas dos encontristas.',          'Encontristas', 20),
  ('encontristas.editar',     'Cadastrar encontristas',        'Cadastrar e editar fichas de encontristas.',               'Encontristas', 21),
  ('saude.ver',               'Ver informações de saúde',      'Consultar alergias, medicamentos e observações de saúde. Cada acesso é registrado.', 'Encontristas', 22),
  ('grupos.gerenciar',        'Gerenciar grupos',              'Criar grupos e distribuir ou realocar encontristas.',      'Encontristas', 23);

insert into public.role_permissions (role_key, permission_key) values
  ('coord_geral', 'equipes.gerenciar'),
  ('coord_geral', 'servidores.ver_todos'),
  ('coord_geral', 'servidores.editar_todos'),
  ('coord_geral', 'encontristas.ver'),
  ('coord_geral', 'encontristas.editar'),
  ('coord_geral', 'saude.ver'),
  ('coord_geral', 'grupos.gerenciar');
-- O papel 'admin' recebe todas as permissões de forma implícita (ver has_perm).

-- -----------------------------------------------------------------------------
-- Funções de acesso (usadas pelas políticas RLS)
-- -----------------------------------------------------------------------------

-- Sessão válida: perfil ativo e sessão emitida depois da última revogação.
create or replace function public.session_is_valid()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active
      and (
        p.sessions_revoked_at is null
        or coalesce((auth.jwt() ->> 'iat')::bigint, 0) > extract(epoch from p.sessions_revoked_at)::bigint
      )
  )
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.session_is_valid()
     and exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role_key = 'admin')
$$;

create or replace function public.has_perm(p text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.session_is_valid() and (
    exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role_key = 'admin')
    or exists (
      select 1 from public.user_roles ur
      join public.role_permissions rp on rp.role_key = ur.role_key
      where ur.user_id = auth.uid() and rp.permission_key = p
    )
    or exists (select 1 from public.user_permissions up where up.user_id = auth.uid() and up.permission_key = p)
  )
$$;

-- -----------------------------------------------------------------------------
-- Acampamento
-- -----------------------------------------------------------------------------

create table public.camps (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (char_length(trim(name)) between 2 and 120),
  description     text check (description is null or char_length(description) <= 2000),
  start_date      date,
  end_date        date,
  location        text check (location is null or char_length(location) <= 200),
  responsaveis    text check (responsaveis is null or char_length(responsaveis) <= 500),
  status          public.camp_status not null default 'planejamento',
  is_active       boolean not null default false,
  shirt_sizes     text[] not null default array['PP','P','M','G','GG','XG','XXG'],
  signup_fields   jsonb not null default '[]'::jsonb check (jsonb_typeof(signup_fields) = 'array'),
  privacy_notice  text check (privacy_notice is null or char_length(privacy_notice) <= 3000),
  operational_notes text check (operational_notes is null or char_length(operational_notes) <= 3000),
  archived_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.profiles (id) on delete set null,
  check (end_date is null or start_date is null or end_date >= start_date),
  check (cardinality(shirt_sizes) between 1 and 30),
  check (not (is_active and status = 'arquivado'))
);
create unique index camps_one_active on public.camps (is_active) where is_active;
create trigger camps_updated_at before update on public.camps
  for each row execute function public.tg_set_updated_at();

create or replace function public.active_camp_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.camps where is_active limit 1
$$;

-- Acampamento aceita alterações operacionais? (não encerrado nem arquivado)
create or replace function public.camp_is_editable(p_camp uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.camps c
    where c.id = p_camp and c.is_active and c.status not in ('encerrado', 'arquivado')
  )
$$;

-- -----------------------------------------------------------------------------
-- Equipes de serviço
-- -----------------------------------------------------------------------------

create table public.service_teams (
  id              uuid primary key default gen_random_uuid(),
  camp_id         uuid not null references public.camps (id) on delete restrict,
  name            text not null check (char_length(trim(name)) between 2 and 80),
  description     text check (description is null or char_length(description) <= 1000),
  capacity        int not null check (capacity between 1 and 2000),
  status          public.team_status not null default 'aberta',
  slug            text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 6 and 80),
  internal_notes  text check (internal_notes is null or char_length(internal_notes) <= 2000),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.profiles (id) on delete set null
);
create unique index service_teams_unique_name on public.service_teams (camp_id, public.normalize_text(name));
create index service_teams_camp on public.service_teams (camp_id);
create trigger service_teams_updated_at before update on public.service_teams
  for each row execute function public.tg_set_updated_at();

create or replace function public.make_slug(base text)
returns text
language sql
volatile
set search_path = public, extensions
as $$
  select coalesce(nullif(trim(both '-' from left(regexp_replace(public.normalize_text(base), '[^a-z0-9]+', '-', 'g'), 40)), ''), 'equipe')
         || '-' || substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 8)
$$;

create or replace function public.tg_service_team_slug()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug := public.make_slug(new.name);
  end if;
  return new;
end;
$$;
create trigger service_teams_slug before insert on public.service_teams
  for each row execute function public.tg_service_team_slug();

create table public.service_team_coordinators (
  team_id     uuid not null references public.service_teams (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.profiles (id) on delete set null,
  primary key (team_id, user_id)
);
create index service_team_coordinators_user on public.service_team_coordinators (user_id);

create or replace function public.is_team_coord(p_team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.session_is_valid() and exists (
    select 1 from public.service_team_coordinators c
    where c.team_id = p_team and c.user_id = auth.uid()
  )
$$;

create or replace function public.can_view_team(p_team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_perm('equipes.gerenciar')
      or public.has_perm('servidores.ver_todos')
      or public.is_team_coord(p_team)
$$;

create or replace function public.can_view_team_members(p_team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_perm('servidores.ver_todos') or public.is_team_coord(p_team)
$$;

create or replace function public.can_edit_team_members(p_team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_perm('servidores.editar_todos') or public.is_team_coord(p_team)
$$;

-- -----------------------------------------------------------------------------
-- Pessoas (identidade, separada da inscrição) — sempre dentro de um acampamento
-- -----------------------------------------------------------------------------

create table public.people (
  id               uuid primary key default gen_random_uuid(),
  camp_id          uuid not null references public.camps (id) on delete restrict,
  full_name        text not null check (char_length(trim(full_name)) between 3 and 150),
  name_normalized  text generated always as (public.normalize_text(full_name)) stored,
  phone            text check (phone is null or phone ~ '^[0-9]{10,11}$'),
  birth_date       date check (birth_date is null or birth_date >= date '1900-01-01'),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index people_unique_phone_birth on public.people (camp_id, phone, birth_date) where phone is not null and birth_date is not null;
create index people_camp_name on public.people (camp_id, name_normalized);
create index people_camp_phone on public.people (camp_id, phone);
create trigger people_updated_at before update on public.people
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- Inscrições de servidores (vínculo pessoa ↔ equipe no acampamento)
-- -----------------------------------------------------------------------------

create table public.service_team_memberships (
  id              uuid primary key default gen_random_uuid(),
  camp_id         uuid not null references public.camps (id) on delete restrict,
  team_id         uuid not null references public.service_teams (id) on delete restrict,
  person_id       uuid not null references public.people (id) on delete restrict,
  status          public.membership_status not null default 'ativa',
  shirt_size      text check (shirt_size is null or char_length(shirt_size) <= 20),
  extra_answers   jsonb not null default '{}'::jsonb check (jsonb_typeof(extra_answers) = 'object'),
  admin_notes     text check (admin_notes is null or char_length(admin_notes) <= 2000),
  source          text not null check (source in ('link_publico', 'cadastro_interno')),
  consent_at      timestamptz,
  payment_status  public.payment_status not null default 'pendente',
  cancelled_at    timestamptz,
  cancelled_by    uuid references public.profiles (id) on delete set null,
  cancel_reason   text check (cancel_reason is null or char_length(cancel_reason) <= 500),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.profiles (id) on delete set null
);
-- Uma pessoa só pode ter uma inscrição ativa de servidor por acampamento.
create unique index memberships_one_active_per_person on public.service_team_memberships (camp_id, person_id) where status = 'ativa';
create index memberships_team_status on public.service_team_memberships (team_id, status);
create index memberships_camp on public.service_team_memberships (camp_id);
create trigger memberships_updated_at before update on public.service_team_memberships
  for each row execute function public.tg_set_updated_at();

create or replace function public.team_occupancy(p_team uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.service_team_memberships m
  where m.team_id = p_team and m.status = 'ativa'
$$;

-- -----------------------------------------------------------------------------
-- Encontristas
-- -----------------------------------------------------------------------------

create table public.encontristas (
  id                      uuid primary key default gen_random_uuid(),
  camp_id                 uuid not null references public.camps (id) on delete restrict,
  person_id               uuid not null references public.people (id) on delete restrict,
  status                  public.encontrista_status not null default 'ativo',
  shirt_size              text check (shirt_size is null or char_length(shirt_size) <= 20),
  emergency_name          text check (emergency_name is null or char_length(emergency_name) <= 150),
  emergency_phone         text check (emergency_phone is null or emergency_phone ~ '^[0-9]{10,11}$'),
  emergency_relationship  text check (emergency_relationship is null or char_length(emergency_relationship) <= 60),
  form_notes              text check (form_notes is null or char_length(form_notes) <= 2000),
  admin_notes             text check (admin_notes is null or char_length(admin_notes) <= 2000),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  created_by              uuid references public.profiles (id) on delete set null
);
create unique index encontristas_one_active_per_person on public.encontristas (camp_id, person_id) where status = 'ativo';
create index encontristas_camp on public.encontristas (camp_id, status);
create trigger encontristas_updated_at before update on public.encontristas
  for each row execute function public.tg_set_updated_at();

-- Saúde: tabela separada, sem leitura direta. Acesso apenas pelas funções
-- get_encontrista_health / update_encontrista_health, que exigem permissão e
-- registram o acesso na auditoria.
create table public.participant_health (
  encontrista_id      uuid primary key references public.encontristas (id) on delete cascade,
  allergies_status    public.health_info_status not null default 'nao_informado',
  allergies           text check (allergies is null or char_length(allergies) <= 1000),
  medications_status  public.health_info_status not null default 'nao_informado',
  medications         text check (medications is null or char_length(medications) <= 1000),
  health_notes        text check (health_notes is null or char_length(health_notes) <= 2000),
  updated_at          timestamptz not null default now(),
  updated_by          uuid references public.profiles (id) on delete set null
);

-- -----------------------------------------------------------------------------
-- Grupos de encontristas (diferentes das equipes de serviço)
-- -----------------------------------------------------------------------------

create table public.participant_groups (
  id            uuid primary key default gen_random_uuid(),
  camp_id       uuid not null references public.camps (id) on delete restrict,
  name          text not null check (char_length(trim(name)) between 1 and 80),
  description   text check (description is null or char_length(description) <= 1000),
  responsaveis  text check (responsaveis is null or char_length(responsaveis) <= 300),
  capacity      int check (capacity is null or capacity between 1 and 2000),
  notes         text check (notes is null or char_length(notes) <= 2000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references public.profiles (id) on delete set null
);
create unique index participant_groups_unique_name on public.participant_groups (camp_id, public.normalize_text(name));
create trigger participant_groups_updated_at before update on public.participant_groups
  for each row execute function public.tg_set_updated_at();

create table public.participant_group_assignments (
  encontrista_id  uuid primary key references public.encontristas (id) on delete cascade,
  group_id        uuid not null references public.participant_groups (id) on delete restrict,
  assigned_at     timestamptz not null default now(),
  assigned_by     uuid references public.profiles (id) on delete set null
);
create index participant_group_assignments_group on public.participant_group_assignments (group_id);

create table public.group_assignment_history (
  id              bigint generated always as identity primary key,
  encontrista_id  uuid not null references public.encontristas (id) on delete cascade,
  from_group_id   uuid references public.participant_groups (id) on delete set null,
  to_group_id     uuid references public.participant_groups (id) on delete set null,
  changed_by      uuid references public.profiles (id) on delete set null,
  changed_at      timestamptz not null default now()
);
create index group_assignment_history_enc on public.group_assignment_history (encontrista_id, changed_at desc);

create or replace function public.group_occupancy(p_group uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.participant_group_assignments a
  join public.encontristas e on e.id = a.encontrista_id
  where a.group_id = p_group and e.status = 'ativo'
$$;

-- -----------------------------------------------------------------------------
-- Auditoria
-- -----------------------------------------------------------------------------

create table public.audit_logs (
  id          bigint generated always as identity primary key,
  camp_id     uuid,
  user_id     uuid,
  action      text not null,
  entity      text not null,
  entity_id   text,
  before      jsonb,
  after       jsonb,
  created_at  timestamptz not null default now()
);
create index audit_logs_entity on public.audit_logs (entity, entity_id, created_at desc);
create index audit_logs_created on public.audit_logs (created_at desc);
create index audit_logs_user on public.audit_logs (user_id, created_at desc);

create or replace function public.write_audit(
  p_action text, p_entity text, p_entity_id text, p_camp uuid, p_before jsonb, p_after jsonb
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.audit_logs (camp_id, user_id, action, entity, entity_id, before, after)
  values (p_camp, auth.uid(), p_action, p_entity, p_entity_id, p_before, p_after)
$$;

-- Gatilho genérico. TG_ARGV[0] = coluna-chave; TG_ARGV[1] = 'redact' para
-- registrar apenas QUAIS campos mudaram, sem os valores (dados de saúde).
create or replace function public.tg_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_before jsonb;
  v_after jsonb;
  v_key text := coalesce(tg_argv[0], 'id');
  v_redact boolean := coalesce(tg_argv[1], '') = 'redact';
  v_changed text[];
  k text;
begin
  if tg_op in ('UPDATE', 'DELETE') then v_old := to_jsonb(old) - 'updated_at' - 'name_normalized'; end if;
  if tg_op in ('INSERT', 'UPDATE') then v_new := to_jsonb(new) - 'updated_at' - 'name_normalized'; end if;

  if tg_op = 'UPDATE' then
    v_before := '{}'::jsonb;
    v_after := '{}'::jsonb;
    v_changed := array[]::text[];
    for k in select jsonb_object_keys(v_new) loop
      if (v_old -> k) is distinct from (v_new -> k) then
        v_before := v_before || jsonb_build_object(k, v_old -> k);
        v_after := v_after || jsonb_build_object(k, v_new -> k);
        v_changed := v_changed || k;
      end if;
    end loop;
    if cardinality(v_changed) = 0 then
      return new;
    end if;
  else
    v_before := v_old;
    v_after := v_new;
  end if;

  if v_redact then
    v_before := null;
    v_after := jsonb_build_object('campos', coalesce(to_jsonb(v_changed), to_jsonb(array(select jsonb_object_keys(coalesce(v_new, v_old))))));
  end if;

  insert into public.audit_logs (camp_id, user_id, action, entity, entity_id, before, after)
  values (
    coalesce((v_new ->> 'camp_id')::uuid, (v_old ->> 'camp_id')::uuid),
    auth.uid(),
    tg_op,
    tg_table_name,
    coalesce(v_new ->> v_key, v_old ->> v_key),
    v_before,
    v_after
  );
  return coalesce(new, old);
end;
$$;

create trigger audit_profiles after insert or update or delete on public.profiles
  for each row execute function public.tg_audit('id');
create trigger audit_user_roles after insert or update or delete on public.user_roles
  for each row execute function public.tg_audit('user_id');
create trigger audit_user_permissions after insert or update or delete on public.user_permissions
  for each row execute function public.tg_audit('user_id');
create trigger audit_camps after insert or update or delete on public.camps
  for each row execute function public.tg_audit('id');
create trigger audit_service_teams after insert or update or delete on public.service_teams
  for each row execute function public.tg_audit('id');
create trigger audit_service_team_coordinators after insert or update or delete on public.service_team_coordinators
  for each row execute function public.tg_audit('team_id');
create trigger audit_people after insert or update or delete on public.people
  for each row execute function public.tg_audit('id');
create trigger audit_memberships after insert or update or delete on public.service_team_memberships
  for each row execute function public.tg_audit('id');
create trigger audit_encontristas after insert or update or delete on public.encontristas
  for each row execute function public.tg_audit('id');
create trigger audit_participant_health after insert or update or delete on public.participant_health
  for each row execute function public.tg_audit('encontrista_id', 'redact');
create trigger audit_participant_groups after insert or update or delete on public.participant_groups
  for each row execute function public.tg_audit('id');
create trigger audit_group_assignments after insert or update or delete on public.participant_group_assignments
  for each row execute function public.tg_audit('encontrista_id');

-- Não deixa o sistema ficar sem nenhum administrador ativo.
create or replace function public.tg_keep_one_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'DELETE' and old.role_key = 'admin') then
    if not exists (
      select 1 from public.user_roles ur join public.profiles p on p.id = ur.user_id
      where ur.role_key = 'admin' and p.active and ur.user_id <> old.user_id
    ) then
      perform public.raise_app_error('ULTIMO_ADMIN');
    end if;
  end if;
  return old;
end;
$$;
create trigger user_roles_keep_admin before delete on public.user_roles
  for each row execute function public.tg_keep_one_admin();

create or replace function public.tg_keep_one_active_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.active and not new.active
     and exists (select 1 from public.user_roles where user_id = new.id and role_key = 'admin')
     and not exists (
       select 1 from public.user_roles ur join public.profiles p on p.id = ur.user_id
       where ur.role_key = 'admin' and p.active and ur.user_id <> new.id
     ) then
    perform public.raise_app_error('ULTIMO_ADMIN');
  end if;
  return new;
end;
$$;
create trigger profiles_keep_admin before update of active on public.profiles
  for each row execute function public.tg_keep_one_active_admin();

-- -----------------------------------------------------------------------------
-- Visões de listagem (respeitam a RLS de quem consulta)
-- -----------------------------------------------------------------------------

create view public.service_teams_overview
with (security_invoker = on) as
select
  t.id, t.camp_id, t.name, t.description, t.capacity, t.status, t.slug, t.internal_notes,
  t.created_at, t.updated_at,
  public.team_occupancy(t.id) as occupied,
  greatest(t.capacity - public.team_occupancy(t.id), 0) as available,
  (select count(*)::int from public.service_team_coordinators c where c.team_id = t.id) as coordinator_count
from public.service_teams t;

create view public.servidores_list
with (security_invoker = on) as
select
  m.id, m.camp_id, m.team_id, t.name as team_name, m.status, m.shirt_size, m.payment_status,
  m.source, m.created_at, m.person_id, p.full_name, p.name_normalized, p.phone, p.birth_date
from public.service_team_memberships m
join public.people p on p.id = m.person_id
join public.service_teams t on t.id = m.team_id;

create view public.encontristas_list
with (security_invoker = on) as
select
  e.id, e.camp_id, e.status, e.shirt_size, e.created_at, e.person_id,
  p.full_name, p.name_normalized, p.phone, p.birth_date,
  a.group_id, g.name as group_name
from public.encontristas e
join public.people p on p.id = e.person_id
left join public.participant_group_assignments a on a.encontrista_id = e.id
left join public.participant_groups g on g.id = a.group_id;

create view public.participant_groups_overview
with (security_invoker = on) as
select g.*, public.group_occupancy(g.id) as occupied
from public.participant_groups g;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.profiles                      enable row level security;
alter table public.roles                         enable row level security;
alter table public.permissions                   enable row level security;
alter table public.role_permissions              enable row level security;
alter table public.user_roles                    enable row level security;
alter table public.user_permissions              enable row level security;
alter table public.camps                         enable row level security;
alter table public.service_teams                 enable row level security;
alter table public.service_team_coordinators     enable row level security;
alter table public.people                        enable row level security;
alter table public.service_team_memberships      enable row level security;
alter table public.encontristas                  enable row level security;
alter table public.participant_health            enable row level security;
alter table public.participant_groups            enable row level security;
alter table public.participant_group_assignments enable row level security;
alter table public.group_assignment_history      enable row level security;
alter table public.audit_logs                    enable row level security;

-- Perfis: qualquer usuário válido vê nomes (para listar coordenadores);
-- alterações apenas por quem gerencia usuários.
create policy profiles_select on public.profiles for select to authenticated
  using (public.session_is_valid());
-- Quem gerencia usuários não pode alterar um administrador, a menos que
-- também seja administrador.
create or replace function public.can_manage_user(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_perm('usuarios.gerenciar') and (
    public.is_admin()
    or not exists (select 1 from public.user_roles ur where ur.user_id = p_user and ur.role_key = 'admin')
  )
$$;

create policy profiles_update on public.profiles for update to authenticated
  using (public.can_manage_user(id))
  with check (public.can_manage_user(id));

create policy roles_select on public.roles for select to authenticated using (public.session_is_valid());
create policy permissions_select on public.permissions for select to authenticated using (public.session_is_valid());
create policy role_permissions_select on public.role_permissions for select to authenticated using (public.session_is_valid());

create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_perm('usuarios.gerenciar'));
create policy user_roles_insert on public.user_roles for insert to authenticated
  with check (public.can_manage_user(user_id) and (role_key <> 'admin' or public.is_admin()));
create policy user_roles_delete on public.user_roles for delete to authenticated
  using (public.can_manage_user(user_id) and (role_key <> 'admin' or public.is_admin()));

create policy user_permissions_select on public.user_permissions for select to authenticated
  using (user_id = auth.uid() or public.has_perm('usuarios.gerenciar'));
create policy user_permissions_insert on public.user_permissions for insert to authenticated
  with check (public.can_manage_user(user_id));
create policy user_permissions_delete on public.user_permissions for delete to authenticated
  using (public.can_manage_user(user_id));

-- Acampamento
create policy camps_select on public.camps for select to authenticated
  using (public.session_is_valid() and (is_active or public.has_perm('acampamento.gerenciar')));
create policy camps_insert on public.camps for insert to authenticated
  with check (public.has_perm('acampamento.gerenciar'));
create policy camps_update on public.camps for update to authenticated
  using (public.has_perm('acampamento.gerenciar'))
  with check (public.has_perm('acampamento.gerenciar'));

-- Equipes
create policy service_teams_select on public.service_teams for select to authenticated
  using (public.can_view_team(id));
create policy service_teams_insert on public.service_teams for insert to authenticated
  with check (public.has_perm('equipes.gerenciar') and public.camp_is_editable(camp_id));
create policy service_teams_update on public.service_teams for update to authenticated
  using (public.has_perm('equipes.gerenciar') and public.camp_is_editable(camp_id))
  with check (public.has_perm('equipes.gerenciar') and public.camp_is_editable(camp_id));
create policy service_teams_delete on public.service_teams for delete to authenticated
  using (public.has_perm('equipes.gerenciar') and public.camp_is_editable(camp_id));

create policy service_team_coordinators_select on public.service_team_coordinators for select to authenticated
  using (public.can_view_team(team_id));
create policy service_team_coordinators_insert on public.service_team_coordinators for insert to authenticated
  with check (public.has_perm('equipes.gerenciar'));
create policy service_team_coordinators_delete on public.service_team_coordinators for delete to authenticated
  using (public.has_perm('equipes.gerenciar'));

-- Pessoas: visíveis para quem pode ver a inscrição ou a ficha vinculada.
create policy people_select on public.people for select to authenticated
  using (
    exists (select 1 from public.service_team_memberships m
            where m.person_id = people.id and public.can_view_team_members(m.team_id))
    or (public.has_perm('encontristas.ver')
        and exists (select 1 from public.encontristas e where e.person_id = people.id))
  );
create policy people_update on public.people for update to authenticated
  using (
    public.camp_is_editable(camp_id) and (
      exists (select 1 from public.service_team_memberships m
              where m.person_id = people.id and public.can_edit_team_members(m.team_id))
      or (public.has_perm('encontristas.editar')
          and exists (select 1 from public.encontristas e where e.person_id = people.id))
    )
  )
  with check (public.camp_is_editable(camp_id));

-- Inscrições de servidores
create policy memberships_select on public.service_team_memberships for select to authenticated
  using (public.can_view_team_members(team_id));
create policy memberships_update on public.service_team_memberships for update to authenticated
  using (public.can_edit_team_members(team_id) and public.camp_is_editable(camp_id))
  with check (public.can_edit_team_members(team_id) and public.camp_is_editable(camp_id));

-- Encontristas
create policy encontristas_select on public.encontristas for select to authenticated
  using (public.has_perm('encontristas.ver'));
create policy encontristas_update on public.encontristas for update to authenticated
  using (public.has_perm('encontristas.editar') and public.camp_is_editable(camp_id))
  with check (public.has_perm('encontristas.editar') and public.camp_is_editable(camp_id));

-- Saúde: nenhuma política = nenhum acesso direto. Só pelas funções.

-- Grupos
create policy participant_groups_select on public.participant_groups for select to authenticated
  using (public.has_perm('encontristas.ver') or public.has_perm('grupos.gerenciar'));
create policy participant_groups_insert on public.participant_groups for insert to authenticated
  with check (public.has_perm('grupos.gerenciar') and public.camp_is_editable(camp_id));
create policy participant_groups_update on public.participant_groups for update to authenticated
  using (public.has_perm('grupos.gerenciar') and public.camp_is_editable(camp_id))
  with check (public.has_perm('grupos.gerenciar') and public.camp_is_editable(camp_id));
create policy participant_groups_delete on public.participant_groups for delete to authenticated
  using (public.has_perm('grupos.gerenciar') and public.camp_is_editable(camp_id));

create policy group_assignments_select on public.participant_group_assignments for select to authenticated
  using (public.has_perm('encontristas.ver') or public.has_perm('grupos.gerenciar'));

create policy group_history_select on public.group_assignment_history for select to authenticated
  using (public.has_perm('encontristas.ver'));

-- Auditoria: somente leitura, e somente com permissão.
create policy audit_logs_select on public.audit_logs for select to authenticated
  using (public.has_perm('auditoria.ver'));

-- -----------------------------------------------------------------------------
-- Funções de negócio (RPC)
-- -----------------------------------------------------------------------------

-- Dados de acesso do usuário logado.
create or replace function public.my_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_admin boolean;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.id is null or not public.session_is_valid() then
    return null;
  end if;
  v_admin := exists (select 1 from public.user_roles where user_id = v_profile.id and role_key = 'admin');
  return jsonb_build_object(
    'user_id', v_profile.id,
    'username', v_profile.username,
    'full_name', v_profile.full_name,
    'must_change_password', v_profile.must_change_password,
    'is_admin', v_admin,
    'roles', coalesce((select jsonb_agg(role_key order by role_key) from public.user_roles where user_id = v_profile.id), '[]'::jsonb),
    'permissions', coalesce((
      select jsonb_agg(distinct p.key)
      from public.permissions p
      where v_admin
         or exists (select 1 from public.user_roles ur join public.role_permissions rp on rp.role_key = ur.role_key
                    where ur.user_id = v_profile.id and rp.permission_key = p.key)
         or exists (select 1 from public.user_permissions up where up.user_id = v_profile.id and up.permission_key = p.key)
    ), '[]'::jsonb),
    'coordinated_team_ids', coalesce((
      select jsonb_agg(c.team_id)
      from public.service_team_coordinators c
      join public.service_teams t on t.id = c.team_id
      where c.user_id = v_profile.id and t.camp_id = public.active_camp_id()
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.mark_password_changed()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set must_change_password = false where id = auth.uid() and active
$$;

-- Encerra todas as sessões de um usuário (refresh tokens + tokens já emitidos).
create or replace function public.revoke_user_sessions(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.can_manage_user(p_user) then
    perform public.raise_app_error('SEM_PERMISSAO');
  end if;
  update public.profiles set sessions_revoked_at = now() where id = p_user;
  delete from auth.sessions where user_id = p_user;
  perform public.write_audit('REVOKE_SESSIONS', 'profiles', p_user::text, null, null, null);
end;
$$;

-- Validação das respostas extras configuradas no acampamento.
create or replace function public.clean_extra_answers(p_fields jsonb, p_answers jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  f jsonb;
  v_key text;
  v_val text;
  v_out jsonb := '{}'::jsonb;
begin
  for f in select * from jsonb_array_elements(coalesce(p_fields, '[]'::jsonb)) loop
    v_key := f ->> 'key';
    continue when v_key is null;
    v_val := nullif(trim(coalesce(p_answers ->> v_key, '')), '');
    if v_val is null then
      if coalesce((f ->> 'required')::boolean, false) then
        perform public.raise_app_error('CAMPO_OBRIGATORIO', coalesce(f ->> 'label', v_key));
      end if;
      continue;
    end if;
    if char_length(v_val) > 300 then
      perform public.raise_app_error('CAMPO_INVALIDO', coalesce(f ->> 'label', v_key));
    end if;
    if f ->> 'type' = 'select' and not (coalesce(f -> 'options', '[]'::jsonb) ? v_val) then
      perform public.raise_app_error('CAMPO_INVALIDO', coalesce(f ->> 'label', v_key));
    end if;
    v_out := v_out || jsonb_build_object(v_key, v_val);
  end loop;
  return v_out;
end;
$$;

-- Núcleo da inscrição de servidor. Trava a linha da equipe (FOR UPDATE) para
-- que inscrições simultâneas sejam processadas em fila: a última vaga nunca é
-- ocupada duas vezes. Não pode ser chamada diretamente pelo navegador.
create or replace function public._register_servidor(
  p_team uuid,
  p_full_name text,
  p_phone text,
  p_birth_date date,
  p_shirt_size text,
  p_extra jsonb,
  p_source text,
  p_actor uuid,
  p_consent boolean
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team public.service_teams;
  v_camp public.camps;
  v_name text := regexp_replace(trim(coalesce(p_full_name, '')), '\s+', ' ', 'g');
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_person uuid;
  v_extra jsonb;
  v_id uuid;
begin
  select * into v_team from public.service_teams where id = p_team for update;
  if v_team.id is null then
    perform public.raise_app_error('EQUIPE_NAO_ENCONTRADA');
  end if;
  select * into v_camp from public.camps where id = v_team.camp_id;

  if not v_camp.is_active or v_camp.status in ('encerrado', 'arquivado') then
    perform public.raise_app_error('INSCRICOES_FECHADAS');
  end if;
  if p_source = 'link_publico' and (v_camp.status <> 'inscricoes_abertas' or v_team.status <> 'aberta') then
    perform public.raise_app_error('INSCRICOES_FECHADAS');
  end if;
  if v_team.status = 'inativa' then
    perform public.raise_app_error('INSCRICOES_FECHADAS');
  end if;

  if char_length(v_name) < 3 or char_length(v_name) > 150 then
    perform public.raise_app_error('NOME_INVALIDO');
  end if;
  if v_phone !~ '^[0-9]{10,11}$' then
    perform public.raise_app_error('TELEFONE_INVALIDO');
  end if;
  if p_birth_date is null or p_birth_date < date '1900-01-01' or p_birth_date > (now() at time zone 'America/Sao_Paulo')::date then
    perform public.raise_app_error('DATA_NASCIMENTO_INVALIDA');
  end if;
  if p_shirt_size is null or not (p_shirt_size = any (v_camp.shirt_sizes)) then
    perform public.raise_app_error('TAMANHO_INVALIDO');
  end if;
  if p_source = 'link_publico' and not coalesce(p_consent, false) then
    perform public.raise_app_error('CONSENTIMENTO_OBRIGATORIO');
  end if;
  v_extra := public.clean_extra_answers(v_camp.signup_fields, coalesce(p_extra, '{}'::jsonb));

  if public.team_occupancy(v_team.id) >= v_team.capacity then
    perform public.raise_app_error('SEM_VAGAS');
  end if;

  -- Mesma pessoa = mesmo telefone + data de nascimento, ou mesmo nome + data.
  select p.id into v_person from public.people p
  where p.camp_id = v_camp.id and p.phone = v_phone and p.birth_date = p_birth_date
  limit 1;

  if exists (
    select 1 from public.service_team_memberships m
    join public.people p on p.id = m.person_id
    where m.camp_id = v_camp.id and m.status = 'ativa'
      and (p.id = v_person or (p.name_normalized = public.normalize_text(v_name) and p.birth_date = p_birth_date))
  ) then
    perform public.raise_app_error('JA_INSCRITO');
  end if;

  if v_person is null then
    begin
      insert into public.people (camp_id, full_name, phone, birth_date)
      values (v_camp.id, v_name, v_phone, p_birth_date)
      returning id into v_person;
    exception when unique_violation then
      select p.id into v_person from public.people p
      where p.camp_id = v_camp.id and p.phone = v_phone and p.birth_date = p_birth_date;
    end;
  end if;

  begin
    insert into public.service_team_memberships
      (camp_id, team_id, person_id, status, shirt_size, extra_answers, source, consent_at, created_by)
    values
      (v_camp.id, v_team.id, v_person, 'ativa', p_shirt_size, v_extra, p_source,
       case when p_consent then now() end, p_actor)
    returning id into v_id;
  exception when unique_violation then
    perform public.raise_app_error('JA_INSCRITO');
  end;

  return v_id;
end;
$$;

-- Informações públicas de uma equipe para o formulário de inscrição.
-- Não revela nenhum dado de integrantes.
create or replace function public.public_team_info(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_team public.service_teams;
  v_camp public.camps;
  v_available int;
  v_open boolean;
begin
  select * into v_team from public.service_teams where slug = lower(trim(p_slug));
  if v_team.id is null then
    return null;
  end if;
  select * into v_camp from public.camps where id = v_team.camp_id;
  if not v_camp.is_active or v_camp.status = 'arquivado' or v_team.status = 'inativa' then
    return null;
  end if;
  v_available := greatest(v_team.capacity - public.team_occupancy(v_team.id), 0);
  v_open := v_camp.status = 'inscricoes_abertas' and v_team.status = 'aberta';
  return jsonb_build_object(
    'team_name', v_team.name,
    'team_description', v_team.description,
    'camp_name', v_camp.name,
    'camp_start', v_camp.start_date,
    'camp_end', v_camp.end_date,
    'camp_location', v_camp.location,
    'open', v_open,
    'available', v_available,
    'shirt_sizes', to_jsonb(v_camp.shirt_sizes),
    'signup_fields', v_camp.signup_fields,
    'privacy_notice', v_camp.privacy_notice
  );
end;
$$;

create or replace function public.public_register_servidor(
  p_slug text,
  p_full_name text,
  p_phone text,
  p_birth_date date,
  p_shirt_size text,
  p_extra jsonb,
  p_consent boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team uuid;
begin
  select id into v_team from public.service_teams where slug = lower(trim(p_slug));
  if v_team is null then
    perform public.raise_app_error('EQUIPE_NAO_ENCONTRADA');
  end if;
  perform public._register_servidor(v_team, p_full_name, p_phone, p_birth_date, p_shirt_size, p_extra, 'link_publico', null, p_consent);
  return jsonb_build_object('ok', true);
end;
$$;

-- Cadastro interno de servidor (coordenador da equipe ou coordenação geral).
create or replace function public.staff_register_servidor(
  p_team uuid,
  p_full_name text,
  p_phone text,
  p_birth_date date,
  p_shirt_size text,
  p_extra jsonb,
  p_admin_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not (public.can_edit_team_members(p_team) or public.has_perm('equipes.gerenciar')) then
    perform public.raise_app_error('SEM_PERMISSAO');
  end if;
  v_id := public._register_servidor(p_team, p_full_name, p_phone, p_birth_date, p_shirt_size, p_extra, 'cadastro_interno', auth.uid(), false);
  if nullif(trim(coalesce(p_admin_notes, '')), '') is not null then
    update public.service_team_memberships set admin_notes = left(trim(p_admin_notes), 2000) where id = v_id;
  end if;
  return v_id;
end;
$$;

-- Cancelar ou reativar inscrição. A reativação respeita o limite de vagas.
create or replace function public.set_membership_status(p_id uuid, p_status public.membership_status, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_m public.service_team_memberships;
  v_team public.service_teams;
begin
  select * into v_m from public.service_team_memberships where id = p_id;
  if v_m.id is null then
    perform public.raise_app_error('NAO_ENCONTRADO');
  end if;
  if not public.can_edit_team_members(v_m.team_id) then
    perform public.raise_app_error('SEM_PERMISSAO');
  end if;
  if not public.camp_is_editable(v_m.camp_id) then
    perform public.raise_app_error('ACAMPAMENTO_FECHADO');
  end if;
  if v_m.status = p_status then
    return;
  end if;

  if p_status = 'ativa' then
    select * into v_team from public.service_teams where id = v_m.team_id for update;
    if public.team_occupancy(v_team.id) >= v_team.capacity then
      perform public.raise_app_error('SEM_VAGAS');
    end if;
    begin
      update public.service_team_memberships
        set status = 'ativa', cancelled_at = null, cancelled_by = null, cancel_reason = null
        where id = p_id;
    exception when unique_violation then
      perform public.raise_app_error('JA_INSCRITO');
    end;
  else
    update public.service_team_memberships
      set status = 'cancelada', cancelled_at = now(), cancelled_by = auth.uid(),
          cancel_reason = nullif(left(trim(coalesce(p_reason, '')), 500), '')
      where id = p_id;
  end if;
end;
$$;

-- Transferir servidor para outra equipe (coordenação geral). Trava as duas
-- equipes em ordem fixa para evitar impasse e respeita o limite da nova.
create or replace function public.move_servidor(p_id uuid, p_new_team uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_m public.service_team_memberships;
  v_new public.service_teams;
begin
  if not public.has_perm('equipes.gerenciar') then
    perform public.raise_app_error('SEM_PERMISSAO');
  end if;
  select * into v_m from public.service_team_memberships where id = p_id;
  if v_m.id is null then
    perform public.raise_app_error('NAO_ENCONTRADO');
  end if;
  if v_m.team_id = p_new_team then
    return;
  end if;
  if not public.camp_is_editable(v_m.camp_id) then
    perform public.raise_app_error('ACAMPAMENTO_FECHADO');
  end if;
  perform 1 from public.service_teams where id in (v_m.team_id, p_new_team) order by id for update;
  select * into v_new from public.service_teams where id = p_new_team;
  if v_new.id is null or v_new.camp_id <> v_m.camp_id or v_new.status = 'inativa' then
    perform public.raise_app_error('EQUIPE_NAO_ENCONTRADA');
  end if;
  if v_m.status = 'ativa' and public.team_occupancy(v_new.id) >= v_new.capacity then
    perform public.raise_app_error('SEM_VAGAS');
  end if;
  update public.service_team_memberships set team_id = p_new_team where id = p_id;
end;
$$;

-- Alterar o limite de vagas sem ficar abaixo das inscrições ativas.
create or replace function public.tg_team_capacity_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.capacity < old.capacity and public.team_occupancy(new.id) > new.capacity then
    perform public.raise_app_error('LIMITE_MENOR_QUE_INSCRITOS', public.team_occupancy(new.id)::text);
  end if;
  return new;
end;
$$;
create trigger service_teams_capacity_guard before update of capacity on public.service_teams
  for each row execute function public.tg_team_capacity_guard();

-- Cadastro manual de encontrista (transcrição da ficha física).
create or replace function public.create_encontrista(
  p_full_name text,
  p_phone text,
  p_birth_date date,
  p_shirt_size text,
  p_emergency_name text,
  p_emergency_phone text,
  p_emergency_relationship text,
  p_allergies_status public.health_info_status,
  p_allergies text,
  p_medications_status public.health_info_status,
  p_medications text,
  p_health_notes text,
  p_form_notes text,
  p_admin_notes text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_camp public.camps;
  v_name text := regexp_replace(trim(coalesce(p_full_name, '')), '\s+', ' ', 'g');
  v_phone text := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');
  v_em_phone text := nullif(regexp_replace(coalesce(p_emergency_phone, ''), '\D', '', 'g'), '');
  v_person uuid;
  v_id uuid;
begin
  if not public.has_perm('encontristas.editar') then
    perform public.raise_app_error('SEM_PERMISSAO');
  end if;
  select * into v_camp from public.camps where id = public.active_camp_id();
  if v_camp.id is null then
    perform public.raise_app_error('SEM_ACAMPAMENTO');
  end if;
  if v_camp.status in ('encerrado', 'arquivado') then
    perform public.raise_app_error('ACAMPAMENTO_FECHADO');
  end if;
  if char_length(v_name) < 3 or char_length(v_name) > 150 then
    perform public.raise_app_error('NOME_INVALIDO');
  end if;
  if v_phone is not null and v_phone !~ '^[0-9]{10,11}$' then
    perform public.raise_app_error('TELEFONE_INVALIDO');
  end if;
  if v_em_phone is not null and v_em_phone !~ '^[0-9]{10,11}$' then
    perform public.raise_app_error('TELEFONE_EMERGENCIA_INVALIDO');
  end if;
  if p_birth_date is null or p_birth_date < date '1900-01-01' or p_birth_date > (now() at time zone 'America/Sao_Paulo')::date then
    perform public.raise_app_error('DATA_NASCIMENTO_INVALIDA');
  end if;
  if p_shirt_size is not null and not (p_shirt_size = any (v_camp.shirt_sizes)) then
    perform public.raise_app_error('TAMANHO_INVALIDO');
  end if;

  if v_phone is not null then
    select p.id into v_person from public.people p
    where p.camp_id = v_camp.id and p.phone = v_phone and p.birth_date = p_birth_date
    limit 1;
  end if;

  if exists (
    select 1 from public.encontristas e
    join public.people p on p.id = e.person_id
    where e.camp_id = v_camp.id and e.status = 'ativo'
      and (p.id = v_person or (p.name_normalized = public.normalize_text(v_name) and p.birth_date = p_birth_date))
  ) then
    perform public.raise_app_error('JA_CADASTRADO');
  end if;

  if v_person is null then
    begin
      insert into public.people (camp_id, full_name, phone, birth_date)
      values (v_camp.id, v_name, v_phone, p_birth_date)
      returning id into v_person;
    exception when unique_violation then
      select p.id into v_person from public.people p
      where p.camp_id = v_camp.id and p.phone = v_phone and p.birth_date = p_birth_date;
    end;
  end if;

  begin
    insert into public.encontristas (
      camp_id, person_id, shirt_size, emergency_name, emergency_phone, emergency_relationship,
      form_notes, admin_notes, created_by
    ) values (
      v_camp.id, v_person, p_shirt_size,
      nullif(left(trim(coalesce(p_emergency_name, '')), 150), ''),
      v_em_phone,
      nullif(left(trim(coalesce(p_emergency_relationship, '')), 60), ''),
      nullif(left(trim(coalesce(p_form_notes, '')), 2000), ''),
      nullif(left(trim(coalesce(p_admin_notes, '')), 2000), ''),
      auth.uid()
    ) returning id into v_id;
  exception when unique_violation then
    perform public.raise_app_error('JA_CADASTRADO');
  end;

  insert into public.participant_health (
    encontrista_id, allergies_status, allergies, medications_status, medications, health_notes, updated_by
  ) values (
    v_id,
    coalesce(p_allergies_status, 'nao_informado'),
    case when p_allergies_status = 'possui' then nullif(left(trim(coalesce(p_allergies, '')), 1000), '') end,
    coalesce(p_medications_status, 'nao_informado'),
    case when p_medications_status = 'possui' then nullif(left(trim(coalesce(p_medications, '')), 1000), '') end,
    nullif(left(trim(coalesce(p_health_notes, '')), 2000), ''),
    auth.uid()
  );

  return v_id;
end;
$$;

-- Leitura dos dados de saúde: exige permissão e registra o acesso.
create or replace function public.get_encontrista_health(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_h public.participant_health;
  v_camp uuid;
begin
  if not public.has_perm('saude.ver') then
    perform public.raise_app_error('SEM_PERMISSAO');
  end if;
  select camp_id into v_camp from public.encontristas where id = p_id;
  if v_camp is null then
    perform public.raise_app_error('NAO_ENCONTRADO');
  end if;
  select * into v_h from public.participant_health where encontrista_id = p_id;
  perform public.write_audit('VIEW_HEALTH', 'participant_health', p_id::text, v_camp, null, null);
  return jsonb_build_object(
    'allergies_status', coalesce(v_h.allergies_status, 'nao_informado'),
    'allergies', v_h.allergies,
    'medications_status', coalesce(v_h.medications_status, 'nao_informado'),
    'medications', v_h.medications,
    'health_notes', v_h.health_notes,
    'updated_at', v_h.updated_at,
    'updated_by_name', (select full_name from public.profiles where id = v_h.updated_by)
  );
end;
$$;

create or replace function public.update_encontrista_health(
  p_id uuid,
  p_allergies_status public.health_info_status,
  p_allergies text,
  p_medications_status public.health_info_status,
  p_medications text,
  p_health_notes text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_camp uuid;
begin
  if not (public.has_perm('saude.ver') and public.has_perm('encontristas.editar')) then
    perform public.raise_app_error('SEM_PERMISSAO');
  end if;
  select camp_id into v_camp from public.encontristas where id = p_id;
  if v_camp is null then
    perform public.raise_app_error('NAO_ENCONTRADO');
  end if;
  if not public.camp_is_editable(v_camp) then
    perform public.raise_app_error('ACAMPAMENTO_FECHADO');
  end if;
  insert into public.participant_health as h (
    encontrista_id, allergies_status, allergies, medications_status, medications, health_notes, updated_at, updated_by
  ) values (
    p_id,
    coalesce(p_allergies_status, 'nao_informado'),
    case when p_allergies_status = 'possui' then nullif(left(trim(coalesce(p_allergies, '')), 1000), '') end,
    coalesce(p_medications_status, 'nao_informado'),
    case when p_medications_status = 'possui' then nullif(left(trim(coalesce(p_medications, '')), 1000), '') end,
    nullif(left(trim(coalesce(p_health_notes, '')), 2000), ''),
    now(),
    auth.uid()
  )
  on conflict (encontrista_id) do update set
    allergies_status = excluded.allergies_status,
    allergies = excluded.allergies,
    medications_status = excluded.medications_status,
    medications = excluded.medications,
    health_notes = excluded.health_notes,
    updated_at = now(),
    updated_by = auth.uid();
end;
$$;

-- Atribuir (ou remover, com p_group nulo) encontristas a um grupo.
-- Mantém uma única ficha por pessoa e grava o histórico de cada mudança.
create or replace function public.assign_encontristas(p_ids uuid[], p_group uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.participant_groups;
  v_camp uuid := public.active_camp_id();
  v_new_count int;
  v_id uuid;
  v_old uuid;
  v_changed int := 0;
begin
  if not public.has_perm('grupos.gerenciar') then
    perform public.raise_app_error('SEM_PERMISSAO');
  end if;
  if not public.camp_is_editable(v_camp) then
    perform public.raise_app_error('ACAMPAMENTO_FECHADO');
  end if;
  if p_ids is null or cardinality(p_ids) = 0 then
    return 0;
  end if;
  if cardinality(p_ids) > 500 then
    perform public.raise_app_error('SELECAO_GRANDE');
  end if;
  if exists (
    select 1 from unnest(p_ids) as x(id)
    left join public.encontristas e on e.id = x.id
    where e.id is null or e.camp_id <> v_camp or e.status <> 'ativo'
  ) then
    perform public.raise_app_error('NAO_ENCONTRADO');
  end if;

  if p_group is not null then
    select * into v_group from public.participant_groups where id = p_group for update;
    if v_group.id is null or v_group.camp_id <> v_camp then
      perform public.raise_app_error('GRUPO_NAO_ENCONTRADO');
    end if;
    if v_group.capacity is not null then
      select count(*) into v_new_count from unnest(p_ids) as x(id)
      where not exists (select 1 from public.participant_group_assignments a where a.encontrista_id = x.id and a.group_id = p_group);
      if public.group_occupancy(p_group) + v_new_count > v_group.capacity then
        perform public.raise_app_error('GRUPO_CHEIO', (v_group.capacity - public.group_occupancy(p_group))::text);
      end if;
    end if;
  end if;

  foreach v_id in array (select array_agg(distinct x) from unnest(p_ids) x) loop
    select group_id into v_old from public.participant_group_assignments where encontrista_id = v_id for update;
    if v_old is not distinct from p_group then
      continue;
    end if;
    if p_group is null then
      delete from public.participant_group_assignments where encontrista_id = v_id;
    else
      insert into public.participant_group_assignments (encontrista_id, group_id, assigned_at, assigned_by)
      values (v_id, p_group, now(), auth.uid())
      on conflict (encontrista_id) do update set group_id = excluded.group_id, assigned_at = now(), assigned_by = auth.uid();
    end if;
    insert into public.group_assignment_history (encontrista_id, from_group_id, to_group_id, changed_by)
    values (v_id, v_old, p_group, auth.uid());
    v_changed := v_changed + 1;
  end loop;
  return v_changed;
end;
$$;

-- Alterar o limite de um grupo sem ficar abaixo dos integrantes atuais.
create or replace function public.tg_group_capacity_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.capacity is not null and public.group_occupancy(new.id) > new.capacity then
    perform public.raise_app_error('LIMITE_MENOR_QUE_INSCRITOS', public.group_occupancy(new.id)::text);
  end if;
  return new;
end;
$$;
create trigger participant_groups_capacity_guard before update of capacity on public.participant_groups
  for each row execute function public.tg_group_capacity_guard();

-- Ficha cancelada sai do grupo (com histórico), para não ocupar vaga.
create or replace function public.tg_encontrista_cancel_leaves_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old uuid;
begin
  if new.status = 'cancelado' and old.status <> 'cancelado' then
    delete from public.participant_group_assignments where encontrista_id = new.id returning group_id into v_old;
    if v_old is not null then
      insert into public.group_assignment_history (encontrista_id, from_group_id, to_group_id, changed_by)
      values (new.id, v_old, null, auth.uid());
    end if;
  end if;
  return new;
end;
$$;
create trigger encontristas_cancel_leaves_group after update of status on public.encontristas
  for each row execute function public.tg_encontrista_cancel_leaves_group();

-- Histórico de alterações de um registro, para as fichas.
create or replace function public.record_history(p_entity text, p_id uuid)
returns table (created_at timestamptz, action text, entity text, user_name text, before jsonb, after jsonb)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_person uuid;
  v_team uuid;
begin
  if p_entity = 'encontrista' then
    if not public.has_perm('encontristas.ver') then
      perform public.raise_app_error('SEM_PERMISSAO');
    end if;
    select person_id into v_person from public.encontristas where id = p_id;
    return query
      select l.created_at, l.action, l.entity, pr.full_name, l.before, l.after
      from public.audit_logs l
      left join public.profiles pr on pr.id = l.user_id
      where (l.entity in ('encontristas', 'participant_health', 'participant_group_assignments') and l.entity_id = p_id::text)
         or (l.entity = 'people' and l.entity_id = v_person::text)
      order by l.created_at desc
      limit 200;
  elsif p_entity = 'servidor' then
    select team_id, person_id into v_team, v_person from public.service_team_memberships where id = p_id;
    if v_team is null or not public.can_view_team_members(v_team) then
      perform public.raise_app_error('SEM_PERMISSAO');
    end if;
    return query
      select l.created_at, l.action, l.entity, pr.full_name, l.before, l.after
      from public.audit_logs l
      left join public.profiles pr on pr.id = l.user_id
      where (l.entity = 'service_team_memberships' and l.entity_id = p_id::text)
         or (l.entity = 'people' and l.entity_id = v_person::text)
      order by l.created_at desc
      limit 200;
  else
    perform public.raise_app_error('NAO_ENCONTRADO');
  end if;
end;
$$;

-- Indicadores e alertas do painel, calculados a partir de dados reais e
-- limitados ao que o usuário pode ver.
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
    v_alerts := v_alerts || jsonb_build_object('level', 'warning', 'kind', 'encontristas_sem_grupo', 'text', (v_result ->> 'encontristas_sem_grupo') || ' encontrista(s) ainda sem grupo', 'href', '/grupos/distribuir');
  end if;

  if v_enc and exists (select 1 from public.encontristas where camp_id = v_camp.id and status = 'ativo' and shirt_size is null) then
    v_alerts := v_alerts || jsonb_build_object('level', 'info', 'kind', 'camiseta_sem_tamanho',
      'text', (select count(*) from public.encontristas where camp_id = v_camp.id and status = 'ativo' and shirt_size is null)::text || ' encontrista(s) sem tamanho de camiseta',
      'href', '/encontristas?tamanho=sem');
  end if;

  return v_result || jsonb_build_object('alerts', v_alerts);
end;
$$;

-- -----------------------------------------------------------------------------
-- Privilégios
-- -----------------------------------------------------------------------------
-- O Supabase concede tudo por padrão a anon/authenticated. Aqui retiramos e
-- liberamos apenas o necessário. A RLS continua valendo por cima disso.

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on all tables in schema public to authenticated;
revoke select on public.participant_health from authenticated;

grant update (full_name, phone, active, must_change_password) on public.profiles to authenticated;
grant insert, delete on public.user_roles, public.user_permissions to authenticated;
grant insert, update (name, description, start_date, end_date, location, responsaveis, status, is_active,
                      shirt_sizes, signup_fields, privacy_notice, operational_notes, archived_at)
  on public.camps to authenticated;
grant insert, delete on public.service_teams to authenticated;
grant update (name, description, capacity, status, slug, internal_notes) on public.service_teams to authenticated;
grant insert, delete on public.service_team_coordinators to authenticated;
grant update (full_name, phone, birth_date) on public.people to authenticated;
grant update (shirt_size, admin_notes, extra_answers) on public.service_team_memberships to authenticated;
grant update (shirt_size, emergency_name, emergency_phone, emergency_relationship, form_notes, admin_notes, status)
  on public.encontristas to authenticated;
grant insert, delete on public.participant_groups to authenticated;
grant update (name, description, responsaveis, capacity, notes) on public.participant_groups to authenticated;

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.normalize_text(text),
  public.session_is_valid(),
  public.is_admin(),
  public.has_perm(text),
  public.can_manage_user(uuid),
  public.active_camp_id(),
  public.camp_is_editable(uuid),
  public.is_team_coord(uuid),
  public.can_view_team(uuid),
  public.can_view_team_members(uuid),
  public.can_edit_team_members(uuid),
  public.team_occupancy(uuid),
  public.group_occupancy(uuid),
  public.my_access(),
  public.mark_password_changed(),
  public.revoke_user_sessions(uuid),
  public.staff_register_servidor(uuid, text, text, date, text, jsonb, text),
  public.set_membership_status(uuid, public.membership_status, text),
  public.move_servidor(uuid, uuid),
  public.create_encontrista(text, text, date, text, text, text, text, public.health_info_status, text, public.health_info_status, text, text, text, text),
  public.get_encontrista_health(uuid),
  public.update_encontrista_health(uuid, public.health_info_status, text, public.health_info_status, text, text),
  public.assign_encontristas(uuid[], uuid),
  public.record_history(text, uuid),
  public.dashboard_summary()
to authenticated;

-- Únicas funções acessíveis sem login: o formulário público de inscrição.
grant execute on function
  public.public_team_info(text),
  public.public_register_servidor(text, text, text, date, text, jsonb, boolean)
to anon, authenticated;

-- Funções criadas no futuro também não ficam abertas por padrão.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

commit;
