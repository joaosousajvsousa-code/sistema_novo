-- =============================================================================
-- HOLY CAMP · Migração 0005 — Categorias de despesa = equipes
-- -----------------------------------------------------------------------------
-- Cada equipe de serviço vira automaticamente uma categoria de despesa com o
-- mesmo nome (criada, renomeada e desativada junto com a equipe). Categorias
-- avulsas continuam possíveis. Rode no SQL Editor do Supabase (projeto
-- sistema_holy), depois da 0004.
-- =============================================================================

begin;

alter table public.finance_categories
  add column if not exists team_id uuid unique references public.service_teams (id) on delete set null;

-- Cria ou liga a categoria de despesa de uma equipe.
create or replace function public.sync_team_category(p_team uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team public.service_teams;
  v_cat uuid;
  v_name text;
begin
  select * into v_team from public.service_teams where id = p_team;
  if v_team.id is null then
    return;
  end if;

  select id into v_cat from public.finance_categories where team_id = p_team;
  if v_cat is null then
    -- Já existe uma categoria avulsa com o mesmo nome: liga em vez de duplicar.
    select id into v_cat from public.finance_categories
    where kind = 'despesa' and team_id is null and public.normalize_text(name) = public.normalize_text(v_team.name)
    limit 1;
    if v_cat is not null then
      update public.finance_categories set team_id = p_team where id = v_cat;
    end if;
  end if;

  v_name := left(v_team.name, 60);
  if v_cat is null then
    begin
      insert into public.finance_categories (kind, name, team_id, active, sort)
      values ('despesa', v_name, p_team, v_team.status <> 'inativa', 50);
    exception when unique_violation then
      insert into public.finance_categories (kind, name, team_id, active, sort)
      values ('despesa', left(v_name, 50) || ' (equipe)', p_team, v_team.status <> 'inativa', 50);
    end;
  else
    begin
      update public.finance_categories
        set name = v_name, active = v_team.status <> 'inativa'
        where id = v_cat;
    exception when unique_violation then
      update public.finance_categories
        set name = left(v_name, 50) || ' (equipe)', active = v_team.status <> 'inativa'
        where id = v_cat;
    end;
  end if;
end;
$$;

create or replace function public.tg_team_category()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_team_category(new.id);
  return new;
end;
$$;

drop trigger if exists service_teams_category on public.service_teams;
create trigger service_teams_category after insert or update of name, status on public.service_teams
  for each row execute function public.tg_team_category();

-- Despesa lançada na categoria de uma equipe fica ligada a essa equipe.
create or replace function public.tg_finance_entry_team()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind = 'despesa' then
    new.team_id := (select team_id from public.finance_categories where id = new.category_id);
  end if;
  return new;
end;
$$;
drop trigger if exists finance_entries_team on public.finance_entries;
create trigger finance_entries_team before insert or update of category_id on public.finance_entries
  for each row execute function public.tg_finance_entry_team();

-- Equipes que já existem viram categorias agora.
do $$
declare t record;
begin
  for t in select id from public.service_teams loop
    perform public.sync_team_category(t.id);
  end loop;
end;
$$;

-- Categorias ligadas a equipes não são renomeadas nem desativadas à mão.
drop policy if exists finance_categories_update on public.finance_categories;
create policy finance_categories_update on public.finance_categories for update to authenticated
  using (public.has_perm('financeiro.gerenciar') and team_id is null)
  with check (public.has_perm('financeiro.gerenciar') and team_id is null);

revoke execute on function public.sync_team_category(uuid) from public, anon, authenticated;

commit;
