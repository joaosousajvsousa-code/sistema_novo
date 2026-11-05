-- =============================================================================
-- HOLY CAMP · Migração 0007 — Saúde: cronograma de medicação dos recrutas
-- -----------------------------------------------------------------------------
-- Cada recruta pode ter remédios com horários fixos (ex.: 08:00 e 20:00).
-- O módulo Saúde junta todos em ordem de horário, por dia, e cada dose é
-- marcada como dada (ou não dada) com quem marcou e a hora.
-- Rode no SQL Editor do Supabase (projeto sistema_holy), depois da 0006.
-- =============================================================================

begin;

insert into public.permissions (key, name, description, module, sort) values
  ('saude.medicar', 'Dar medicação', 'Ver o cronograma de remédios e marcar as doses dadas (sem ver alergias e observações de saúde).', 'Recrutas', 23)
on conflict (key) do nothing;
insert into public.role_permissions (role_key, permission_key) values
  ('coord_geral', 'saude.medicar')
on conflict do nothing;

-- Quem vê o cronograma de remédios e marca doses.
create or replace function public.can_view_meds()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_perm('saude.ver') or public.has_perm('saude.medicar')
$$;

-- Quem cadastra e altera os remédios (mesma regra de editar a saúde).
create or replace function public.can_manage_meds()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_perm('saude.ver') and public.has_perm('encontristas.editar')
$$;

create table public.medication_plans (
  id              uuid primary key default gen_random_uuid(),
  camp_id         uuid not null references public.camps (id) on delete restrict,
  encontrista_id  uuid not null references public.encontristas (id) on delete cascade,
  medication      text not null check (char_length(medication) between 1 and 120),
  dose            text check (dose is null or char_length(dose) <= 120),
  times           time[] not null check (cardinality(times) between 1 and 12),
  start_date      date,
  end_date        date,
  instructions    text check (instructions is null or char_length(instructions) <= 500),
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  created_by      uuid references public.profiles (id) on delete set null,
  updated_at      timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index medication_plans_camp on public.medication_plans (camp_id, active);
create index medication_plans_encontrista on public.medication_plans (encontrista_id);

create table public.medication_doses (
  id              uuid primary key default gen_random_uuid(),
  plan_id         uuid not null references public.medication_plans (id) on delete cascade,
  dose_date       date not null,
  dose_time       time not null,
  status          text not null check (status in ('dado', 'nao_dado')),
  note            text check (note is null or char_length(note) <= 300),
  marked_at       timestamptz not null default now(),
  marked_by       uuid references public.profiles (id) on delete set null,
  unique (plan_id, dose_date, dose_time)
);

alter table public.medication_plans enable row level security;
alter table public.medication_doses enable row level security;
create policy medication_plans_select on public.medication_plans for select to authenticated using (public.can_view_meds());
create policy medication_doses_select on public.medication_doses for select to authenticated using (public.can_view_meds());
revoke all on public.medication_plans, public.medication_doses from anon, authenticated;
grant select on public.medication_plans, public.medication_doses to authenticated;

create trigger audit_medication_plans after insert or update or delete on public.medication_plans
  for each row execute function public.tg_audit('id', 'redact');
create trigger audit_medication_doses after insert or update or delete on public.medication_doses
  for each row execute function public.tg_audit('id', 'redact');

-- Cronograma de um dia: cada horário de cada remédio ativo, em ordem.
create or replace function public.medication_schedule(p_date date)
returns table (
  plan_id uuid, encontrista_id uuid, full_name text, group_name text,
  medication text, dose text, instructions text, dose_time time,
  status text, note text, marked_at timestamptz, marked_by_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.can_view_meds() then
    perform public.raise_app_error('SEM_PERMISSAO');
  end if;
  return query
    select mp.id, e.id, p.full_name, g.name, mp.medication, mp.dose, mp.instructions, t.slot,
      coalesce(d.status, 'pendente'), d.note, d.marked_at, pr.full_name
    from public.medication_plans mp
    join public.encontristas e on e.id = mp.encontrista_id
    join public.people p on p.id = e.person_id
    left join public.participant_group_assignments a on a.encontrista_id = e.id
    left join public.participant_groups g on g.id = a.group_id
    cross join lateral unnest(mp.times) as t(slot)
    left join public.medication_doses d on d.plan_id = mp.id and d.dose_date = p_date and d.dose_time = t.slot
    left join public.profiles pr on pr.id = d.marked_by
    where mp.camp_id = public.active_camp_id()
      and mp.active and e.status = 'ativo'
      and (mp.start_date is null or mp.start_date <= p_date)
      and (mp.end_date is null or mp.end_date >= p_date)
    order by t.slot, p.name_normalized, mp.medication;
end;
$$;

-- Marca uma dose: 'dado', 'nao_dado' ou 'pendente' (desfaz).
create or replace function public.mark_medication_dose(p_plan uuid, p_date date, p_time time, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.medication_plans;
begin
  if not public.can_view_meds() then
    perform public.raise_app_error('SEM_PERMISSAO');
  end if;
  select * into v_plan from public.medication_plans where id = p_plan;
  if v_plan.id is null or not (p_time = any (v_plan.times)) then
    perform public.raise_app_error('NAO_ENCONTRADO');
  end if;
  if not public.camp_is_editable(v_plan.camp_id) then
    perform public.raise_app_error('ACAMPAMENTO_FECHADO');
  end if;
  if p_status = 'pendente' then
    delete from public.medication_doses where plan_id = p_plan and dose_date = p_date and dose_time = p_time;
    return;
  end if;
  if p_status not in ('dado', 'nao_dado') then
    perform public.raise_app_error('CAMPO_INVALIDO', 'Situação');
  end if;
  insert into public.medication_doses (plan_id, dose_date, dose_time, status, note, marked_by)
  values (p_plan, p_date, p_time, p_status, nullif(left(trim(coalesce(p_note, '')), 300), ''), auth.uid())
  on conflict (plan_id, dose_date, dose_time) do update
    set status = excluded.status, note = excluded.note, marked_at = now(), marked_by = auth.uid();
end;
$$;

-- Cria ou altera um remédio de um recruta.
create or replace function public.save_medication_plan(
  p_id uuid, p_encontrista uuid, p_medication text, p_dose text, p_times time[],
  p_start date, p_end date, p_instructions text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_e public.encontristas;
  v_times time[];
  v_id uuid;
begin
  if not public.can_manage_meds() then
    perform public.raise_app_error('SEM_PERMISSAO');
  end if;
  select * into v_e from public.encontristas where id = p_encontrista;
  if v_e.id is null or v_e.status <> 'ativo' then
    perform public.raise_app_error('NAO_ENCONTRADO');
  end if;
  if not public.camp_is_editable(v_e.camp_id) then
    perform public.raise_app_error('ACAMPAMENTO_FECHADO');
  end if;
  if char_length(trim(coalesce(p_medication, ''))) = 0 then
    perform public.raise_app_error('CAMPO_OBRIGATORIO', 'Remédio');
  end if;
  select array_agg(distinct x order by x) into v_times from unnest(coalesce(p_times, '{}')) x where x is not null;
  if v_times is null or cardinality(v_times) = 0 then
    perform public.raise_app_error('CAMPO_OBRIGATORIO', 'Horários');
  end if;
  if cardinality(v_times) > 12 then
    perform public.raise_app_error('CAMPO_INVALIDO', 'Horários');
  end if;
  if p_start is not null and p_end is not null and p_end < p_start then
    perform public.raise_app_error('CAMPO_INVALIDO', 'Até');
  end if;

  if p_id is null then
    insert into public.medication_plans (camp_id, encontrista_id, medication, dose, times, start_date, end_date, instructions, created_by)
    values (v_e.camp_id, v_e.id, left(trim(p_medication), 120), nullif(left(trim(coalesce(p_dose, '')), 120), ''), v_times,
      p_start, p_end, nullif(left(trim(coalesce(p_instructions, '')), 500), ''), auth.uid())
    returning id into v_id;
  else
    update public.medication_plans set
      encontrista_id = v_e.id,
      medication = left(trim(p_medication), 120),
      dose = nullif(left(trim(coalesce(p_dose, '')), 120), ''),
      times = v_times,
      start_date = p_start,
      end_date = p_end,
      instructions = nullif(left(trim(coalesce(p_instructions, '')), 500), ''),
      updated_at = now()
    where id = p_id and camp_id = v_e.camp_id
    returning id into v_id;
    if v_id is null then
      perform public.raise_app_error('NAO_ENCONTRADO');
    end if;
  end if;
  return v_id;
end;
$$;

-- Suspende ou reativa um remédio (o histórico de doses continua guardado).
create or replace function public.set_medication_plan_active(p_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_camp uuid;
begin
  if not public.can_manage_meds() then
    perform public.raise_app_error('SEM_PERMISSAO');
  end if;
  select camp_id into v_camp from public.medication_plans where id = p_id;
  if v_camp is null then
    perform public.raise_app_error('NAO_ENCONTRADO');
  end if;
  if not public.camp_is_editable(v_camp) then
    perform public.raise_app_error('ACAMPAMENTO_FECHADO');
  end if;
  update public.medication_plans set active = p_active, updated_at = now() where id = p_id;
end;
$$;

revoke execute on function
  public.can_view_meds(), public.can_manage_meds(), public.medication_schedule(date),
  public.mark_medication_dose(uuid, date, time, text, text),
  public.save_medication_plan(uuid, uuid, text, text, time[], date, date, text),
  public.set_medication_plan_active(uuid, boolean)
from public, anon;
grant execute on function
  public.can_view_meds(), public.can_manage_meds(), public.medication_schedule(date),
  public.mark_medication_dose(uuid, date, time, text, text),
  public.save_medication_plan(uuid, uuid, text, text, time[], date, date, text),
  public.set_medication_plan_active(uuid, boolean)
to authenticated;

commit;
