-- =============================================================================
-- HOLY CAMP · Migração 0003 — Cronograma (programação ao vivo)
-- -----------------------------------------------------------------------------
-- Momentos do cronograma em lista: horário previsto (planned_*), horário
-- original guardado para comparação (original_*), início e fim reais,
-- situação e linha do tempo das mudanças.
-- Rode este arquivo inteiro no SQL Editor do Supabase, depois da 0002.
-- =============================================================================

begin;

create type public.schedule_status as enum ('agendada', 'em_andamento', 'concluida', 'cancelada');

insert into public.permissions (key, name, description, module, sort) values
  ('programacao.gerenciar', 'Gerenciar cronograma', 'Montar o cronograma e marcar o início e o fim de cada momento.', 'Cronograma', 30)
on conflict (key) do nothing;
insert into public.role_permissions (role_key, permission_key) values ('coord_geral', 'programacao.gerenciar')
on conflict do nothing;

create table public.schedule_items (
  id              uuid primary key default gen_random_uuid(),
  camp_id         uuid not null references public.camps (id) on delete restrict,
  title           text not null check (char_length(trim(title)) between 2 and 120),
  description     text check (description is null or char_length(description) <= 1000),
  location        text check (location is null or char_length(location) <= 120),
  responsible     text check (responsible is null or char_length(responsible) <= 120),
  -- Horário previsto atual (muda quando os próximos momentos são ajustados).
  planned_start   timestamptz not null,
  planned_end     timestamptz not null,
  -- Horário do cronograma original (preservado nos ajustes).
  original_start  timestamptz not null,
  original_end    timestamptz not null,
  sort_order      int not null default 0,
  status          public.schedule_status not null default 'agendada',
  actual_start    timestamptz,
  actual_end      timestamptz,
  notes           text check (notes is null or char_length(notes) <= 1000),
  updated_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.profiles (id) on delete set null,
  check (planned_end > planned_start),
  check (original_end > original_start),
  check (actual_end is null or actual_start is null or actual_end >= actual_start)
);
create index schedule_items_camp on public.schedule_items (camp_id, planned_start, sort_order);

create table public.schedule_events (
  id           bigint generated always as identity primary key,
  camp_id      uuid not null references public.camps (id) on delete restrict,
  item_id      uuid references public.schedule_items (id) on delete set null,
  item_title   text not null,
  action       text not null check (action in ('status', 'ajuste', 'criacao', 'edicao', 'exclusao')),
  from_status  public.schedule_status,
  to_status    public.schedule_status,
  minutes      int,
  note         text,
  user_id      uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index schedule_events_camp on public.schedule_events (camp_id, created_at desc);

create or replace function public.tg_schedule_item_events()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' then
    insert into public.schedule_events (camp_id, item_id, item_title, action, user_id)
    values (new.camp_id, new.id, new.title, 'criacao', auth.uid());
  elsif tg_op = 'DELETE' then
    insert into public.schedule_events (camp_id, item_id, item_title, action, user_id)
    values (old.camp_id, null, old.title, 'exclusao', auth.uid());
  elsif new.original_start is distinct from old.original_start
     or new.original_end is distinct from old.original_end
     or new.title is distinct from old.title
     or new.location is distinct from old.location
     or new.responsible is distinct from old.responsible then
    insert into public.schedule_events (camp_id, item_id, item_title, action, user_id)
    values (new.camp_id, new.id, new.title, 'edicao', auth.uid());
  end if;
  return coalesce(new, old);
end;
$function$;

create or replace function public.tg_schedule_item_defaults()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.original_start := coalesce(new.original_start, new.planned_start);
  new.original_end := coalesce(new.original_end, new.planned_end);
  return new;
end;
$function$;

create or replace function public.set_schedule_status(p_id uuid, p_status schedule_status, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_item public.schedule_items;
  v_other public.schedule_items;
  v_now timestamptz := now();
begin
  if not public.has_perm('programacao.gerenciar') then
    perform public.raise_app_error('SEM_PERMISSAO');
  end if;
  select * into v_item from public.schedule_items where id = p_id for update;
  if v_item.id is null then
    perform public.raise_app_error('NAO_ENCONTRADO');
  end if;
  if not public.camp_is_editable(v_item.camp_id) then
    perform public.raise_app_error('ACAMPAMENTO_FECHADO');
  end if;
  if v_item.status = p_status then
    return;
  end if;

  if p_status = 'em_andamento' then
    for v_other in
      select * from public.schedule_items
      where camp_id = v_item.camp_id and status = 'em_andamento' and id <> p_id
      for update
    loop
      update public.schedule_items set status = 'concluida', actual_end = v_now, updated_by = auth.uid() where id = v_other.id;
      insert into public.schedule_events (camp_id, item_id, item_title, action, from_status, to_status, user_id, note)
      values (v_other.camp_id, v_other.id, v_other.title, 'status', 'em_andamento', 'concluida', auth.uid(), 'Concluído ao começar o próximo momento');
    end loop;
    update public.schedule_items
      set status = 'em_andamento', actual_start = coalesce(actual_start, v_now), actual_end = null, updated_by = auth.uid()
      where id = p_id;
  elsif p_status = 'concluida' then
    update public.schedule_items
      set status = 'concluida', actual_start = coalesce(actual_start, v_now), actual_end = v_now, updated_by = auth.uid()
      where id = p_id;
  elsif p_status = 'cancelada' then
    update public.schedule_items set status = 'cancelada', actual_end = null, updated_by = auth.uid() where id = p_id;
  else
    -- Voltar para agendada (correção): apaga os horários reais.
    update public.schedule_items set status = 'agendada', actual_start = null, actual_end = null, updated_by = auth.uid() where id = p_id;
  end if;

  insert into public.schedule_events (camp_id, item_id, item_title, action, from_status, to_status, user_id, note)
  values (v_item.camp_id, v_item.id, v_item.title, 'status', v_item.status, p_status, auth.uid(), nullif(left(trim(coalesce(p_note, '')), 300), ''));
end;
$function$;

create or replace function public.shift_schedule_after(p_id uuid, p_minutes integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_item public.schedule_items;
  v_count int;
begin
  if not public.has_perm('programacao.gerenciar') then
    perform public.raise_app_error('SEM_PERMISSAO');
  end if;
  if p_minutes is null or p_minutes = 0 or abs(p_minutes) > 720 then
    perform public.raise_app_error('AJUSTE_INVALIDO');
  end if;
  select * into v_item from public.schedule_items where id = p_id;
  if v_item.id is null then
    perform public.raise_app_error('NAO_ENCONTRADO');
  end if;
  if not public.camp_is_editable(v_item.camp_id) then
    perform public.raise_app_error('ACAMPAMENTO_FECHADO');
  end if;

  update public.schedule_items s
    set planned_start = s.planned_start + make_interval(mins => p_minutes),
        planned_end = s.planned_end + make_interval(mins => p_minutes),
        updated_by = auth.uid()
    where s.camp_id = v_item.camp_id
      and s.status = 'agendada'
      and s.id <> v_item.id
      and (s.planned_start, s.sort_order) >= (v_item.planned_start, v_item.sort_order);
  get diagnostics v_count = row_count;

  insert into public.schedule_events (camp_id, item_id, item_title, action, minutes, user_id, note)
  values (v_item.camp_id, v_item.id, v_item.title, 'ajuste', p_minutes, auth.uid(), v_count || ' momento(s) seguinte(s) ajustado(s)');
  return v_count;
end;
$function$;

create or replace function public.reset_schedule_to_original()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_camp uuid := public.active_camp_id();
  v_count int;
begin
  if not public.has_perm('programacao.gerenciar') then
    perform public.raise_app_error('SEM_PERMISSAO');
  end if;
  if not public.camp_is_editable(v_camp) then
    perform public.raise_app_error('ACAMPAMENTO_FECHADO');
  end if;
  update public.schedule_items
    set planned_start = original_start, planned_end = original_end, updated_by = auth.uid()
    where camp_id = v_camp and status = 'agendada'
      and (planned_start <> original_start or planned_end <> original_end);
  get diagnostics v_count = row_count;
  if v_count > 0 then
    insert into public.schedule_events (camp_id, item_id, item_title, action, user_id, note)
    values (v_camp, null, 'Cronograma', 'ajuste', auth.uid(), v_count || ' momento(s) voltaram ao horário original');
  end if;
  return v_count;
end;
$function$;


create trigger schedule_items_defaults before insert on public.schedule_items
  for each row execute function public.tg_schedule_item_defaults();
create trigger schedule_items_updated_at before update on public.schedule_items
  for each row execute function public.tg_set_updated_at();
create trigger schedule_items_events after insert or update or delete on public.schedule_items
  for each row execute function public.tg_schedule_item_events();
create trigger audit_schedule_items after insert or update or delete on public.schedule_items
  for each row execute function public.tg_audit('id');

alter table public.schedule_items enable row level security;
alter table public.schedule_events enable row level security;

-- Todos que entram no sistema veem o cronograma; só quem gerencia altera.
create policy schedule_items_select on public.schedule_items for select to authenticated
  using (public.session_is_valid());
create policy schedule_items_insert on public.schedule_items for insert to authenticated
  with check (public.has_perm('programacao.gerenciar') and public.camp_is_editable(camp_id));
create policy schedule_items_update on public.schedule_items for update to authenticated
  using (public.has_perm('programacao.gerenciar') and public.camp_is_editable(camp_id))
  with check (public.has_perm('programacao.gerenciar') and public.camp_is_editable(camp_id));
create policy schedule_items_delete on public.schedule_items for delete to authenticated
  using (public.has_perm('programacao.gerenciar') and public.camp_is_editable(camp_id) and status = 'agendada');
create policy schedule_events_select on public.schedule_events for select to authenticated
  using (public.session_is_valid());

revoke all on public.schedule_items, public.schedule_events from anon, authenticated;
revoke all on sequence public.schedule_events_id_seq from anon, authenticated;
grant select, insert, delete on public.schedule_items to authenticated;
grant select on public.schedule_events to authenticated;
-- Situação e horários reais só mudam pelas funções set_schedule_status/shift.
grant update (title, description, location, responsible, planned_start, planned_end, original_start, original_end, sort_order, notes, updated_by)
  on public.schedule_items to authenticated;

revoke execute on function
  public.set_schedule_status(uuid, public.schedule_status, text),
  public.shift_schedule_after(uuid, integer),
  public.reset_schedule_to_original()
from public, anon;
grant execute on function
  public.set_schedule_status(uuid, public.schedule_status, text),
  public.shift_schedule_after(uuid, integer),
  public.reset_schedule_to_original()
to authenticated;

commit;
