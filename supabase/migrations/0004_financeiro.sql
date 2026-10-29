-- =============================================================================
-- HOLY CAMP · Migração 0004 — Financeiro
-- -----------------------------------------------------------------------------
-- Pagamento dentro da inscrição do soldado/servo, comprovantes privados,
-- categorias, receitas, despesas, orçamento e saldo bancário informado.
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto sistema_holy),
-- depois da 0003.
-- =============================================================================

begin;

-- Permissão explícita: ninguém recebe o financeiro só por ser coordenador.
insert into public.permissions (key, name, description, module, sort) values
  ('financeiro.gerenciar', 'Financeiro', 'Ver e lançar receitas e despesas, orçamento e saldo, e confirmar pagamentos dos soldados/servos.', 'Financeiro', 40)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Comprovantes (arquivos privados no Storage)
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprovantes', 'comprovantes', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;
-- Sem políticas em storage.objects para este bucket: só o servidor do sistema
-- (chave service_role), depois de conferir a permissão, envia e gera links
-- temporários. Nenhum arquivo tem endereço público.

create table public.private_documents (
  id           uuid primary key default gen_random_uuid(),
  camp_id      uuid not null references public.camps (id) on delete restrict,
  bucket       text not null default 'comprovantes',
  path         text not null unique,
  file_name    text not null check (char_length(file_name) <= 200),
  mime_type    text not null,
  size_bytes   int not null check (size_bytes > 0 and size_bytes <= 5242880),
  entity       text not null check (entity in ('pagamento', 'despesa', 'receita')),
  entity_id    uuid not null,
  uploaded_by  uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index private_documents_entity on public.private_documents (entity, entity_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Pagamento na inscrição do soldado/servo
-- -----------------------------------------------------------------------------

alter table public.service_team_memberships
  add column payment_expected      numeric(10, 2) check (payment_expected is null or payment_expected >= 0),
  add column payment_paid          numeric(10, 2) check (payment_paid is null or payment_paid >= 0),
  add column payment_date          date,
  add column payment_method        text check (payment_method is null or payment_method in ('pix', 'dinheiro', 'cartao', 'transferencia', 'outro')),
  add column payment_notes         text check (payment_notes is null or char_length(payment_notes) <= 1000),
  add column payment_confirmed_by  uuid references public.profiles (id) on delete set null,
  add column payment_confirmed_at  timestamptz,
  add column payment_updated_at    timestamptz;

create index memberships_payment on public.service_team_memberships (camp_id, payment_status);

-- Quem pode ver valores e comprovantes do pagamento de uma inscrição.
create or replace function public.can_view_payment(p_membership uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Financeiro, ou o coordenador da própria equipe. A coordenação geral vê só
  -- a situação do pagamento, não valores nem comprovantes.
  select public.has_perm('financeiro.gerenciar') or exists (
    select 1 from public.service_team_memberships m
    where m.id = p_membership and public.is_team_coord(m.team_id)
  )
$$;

-- Registrar o que foi pago (coordenação da equipe ou financeiro). Não confirma:
-- deixa "comprovante enviado" ou "em análise" para conferência do financeiro.
create or replace function public.register_payment(
  p_id uuid,
  p_expected numeric,
  p_paid numeric,
  p_date date,
  p_method text,
  p_notes text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_m public.service_team_memberships;
  v_has_doc boolean;
begin
  select * into v_m from public.service_team_memberships where id = p_id for update;
  if v_m.id is null then
    perform public.raise_app_error('NAO_ENCONTRADO');
  end if;
  if not public.can_view_payment(p_id) then
    perform public.raise_app_error('SEM_PERMISSAO');
  end if;
  if not public.camp_is_editable(v_m.camp_id) then
    perform public.raise_app_error('ACAMPAMENTO_FECHADO');
  end if;
  if v_m.payment_status in ('confirmado', 'estornado') and not public.has_perm('financeiro.gerenciar') then
    perform public.raise_app_error('PAGAMENTO_JA_CONFERIDO');
  end if;
  if (p_expected is not null and (p_expected < 0 or p_expected > 100000))
     or (p_paid is not null and (p_paid < 0 or p_paid > 100000)) then
    perform public.raise_app_error('VALOR_INVALIDO');
  end if;
  if p_method is not null and p_method not in ('pix', 'dinheiro', 'cartao', 'transferencia', 'outro') then
    perform public.raise_app_error('VALOR_INVALIDO');
  end if;
  v_has_doc := exists (select 1 from public.private_documents d where d.entity = 'pagamento' and d.entity_id = p_id);

  update public.service_team_memberships set
    payment_expected = p_expected,
    payment_paid = p_paid,
    payment_date = p_date,
    payment_method = p_method,
    payment_notes = nullif(left(trim(coalesce(p_notes, '')), 1000), ''),
    payment_updated_at = now(),
    payment_status = case
      when payment_status in ('confirmado', 'isento', 'estornado') then payment_status
      when coalesce(p_paid, 0) > 0 and v_has_doc then 'comprovante_enviado'::public.payment_status
      when coalesce(p_paid, 0) > 0 then 'em_analise'::public.payment_status
      else 'pendente'::public.payment_status
    end
  where id = p_id;
end;
$$;

-- Conferência pelo financeiro: confirmar, isentar, estornar ou voltar a pendente.
create or replace function public.set_payment_status(p_id uuid, p_status public.payment_status, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_m public.service_team_memberships;
begin
  if not public.has_perm('financeiro.gerenciar') then
    perform public.raise_app_error('SEM_PERMISSAO');
  end if;
  select * into v_m from public.service_team_memberships where id = p_id for update;
  if v_m.id is null then
    perform public.raise_app_error('NAO_ENCONTRADO');
  end if;
  if not public.camp_is_editable(v_m.camp_id) then
    perform public.raise_app_error('ACAMPAMENTO_FECHADO');
  end if;
  if p_status = 'confirmado' and coalesce(v_m.payment_paid, 0) <= 0 then
    perform public.raise_app_error('PAGAMENTO_SEM_VALOR');
  end if;
  if p_status = 'estornado' and v_m.payment_status <> 'confirmado' then
    perform public.raise_app_error('ESTORNO_INVALIDO');
  end if;
  if p_status not in ('pendente', 'confirmado', 'isento', 'estornado') then
    perform public.raise_app_error('VALOR_INVALIDO');
  end if;

  update public.service_team_memberships set
    payment_status = p_status,
    payment_confirmed_by = case when p_status = 'confirmado' then auth.uid() else payment_confirmed_by end,
    payment_confirmed_at = case when p_status = 'confirmado' then now() else payment_confirmed_at end,
    payment_notes = case
      when nullif(trim(coalesce(p_note, '')), '') is null then payment_notes
      else left(concat_ws(E'\n', payment_notes, trim(p_note)), 1000)
    end,
    payment_updated_at = now()
  where id = p_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Categorias, receitas, despesas, orçamento
-- -----------------------------------------------------------------------------

create table public.finance_categories (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('receita', 'despesa')),
  name       text not null check (char_length(trim(name)) between 2 and 60),
  active     boolean not null default true,
  sort       int not null default 100,
  created_at timestamptz not null default now()
);
create unique index finance_categories_unique on public.finance_categories (kind, public.normalize_text(name));

insert into public.finance_categories (kind, name, sort) values
  ('despesa', 'Alimentação e cozinha', 1),
  ('despesa', 'Infraestrutura', 2),
  ('despesa', 'Liturgia', 3),
  ('despesa', 'Camisetas e materiais', 4),
  ('despesa', 'Transporte', 5),
  ('despesa', 'Comunicação', 6),
  ('despesa', 'Limpeza', 7),
  ('despesa', 'Outros', 99),
  ('receita', 'Doação', 1),
  ('receita', 'Campanha de arrecadação', 2),
  ('receita', 'Outras receitas', 99);

create table public.finance_entries (
  id             uuid primary key default gen_random_uuid(),
  camp_id        uuid not null references public.camps (id) on delete restrict,
  kind           text not null check (kind in ('receita', 'despesa')),
  category_id    uuid not null references public.finance_categories (id) on delete restrict,
  team_id        uuid references public.service_teams (id) on delete set null,
  description    text not null check (char_length(trim(description)) between 2 and 200),
  amount         numeric(12, 2) not null check (amount > 0 and amount <= 10000000),
  entry_date     date not null,
  responsible    text check (responsible is null or char_length(responsible) <= 120),
  notes          text check (notes is null or char_length(notes) <= 1000),
  cancelled_at   timestamptz,
  cancelled_by   uuid references public.profiles (id) on delete set null,
  cancel_reason  text check (cancel_reason is null or char_length(cancel_reason) <= 300),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references public.profiles (id) on delete set null,
  updated_by     uuid references public.profiles (id) on delete set null
);
create index finance_entries_camp on public.finance_entries (camp_id, kind, entry_date desc);
create trigger finance_entries_updated_at before update on public.finance_entries
  for each row execute function public.tg_set_updated_at();

-- A categoria precisa ser do mesmo tipo do lançamento.
create or replace function public.tg_finance_entry_category()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.finance_categories c where c.id = new.category_id and c.kind = new.kind) then
    perform public.raise_app_error('CATEGORIA_INVALIDA');
  end if;
  return new;
end;
$$;
create trigger finance_entries_category before insert or update of category_id, kind on public.finance_entries
  for each row execute function public.tg_finance_entry_category();

create table public.finance_budgets (
  camp_id      uuid not null references public.camps (id) on delete restrict,
  category_id  uuid not null references public.finance_categories (id) on delete restrict,
  amount       numeric(12, 2) not null check (amount >= 0 and amount <= 10000000),
  updated_at   timestamptz not null default now(),
  updated_by   uuid references public.profiles (id) on delete set null,
  primary key (camp_id, category_id)
);

-- Saldo do banco informado pelo financeiro, para comparar com o livro-caixa.
alter table public.camps
  add column bank_balance       numeric(12, 2),
  add column bank_balance_date  date,
  add column bank_balance_by    uuid references public.profiles (id) on delete set null;

-- Auditoria
create trigger audit_finance_entries after insert or update or delete on public.finance_entries
  for each row execute function public.tg_audit('id');
create trigger audit_finance_budgets after insert or update or delete on public.finance_budgets
  for each row execute function public.tg_audit('category_id');
create trigger audit_finance_categories after insert or update or delete on public.finance_categories
  for each row execute function public.tg_audit('id');
create trigger audit_private_documents after insert or update or delete on public.private_documents
  for each row execute function public.tg_audit('id');

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.private_documents  enable row level security;
alter table public.finance_categories enable row level security;
alter table public.finance_entries    enable row level security;
alter table public.finance_budgets    enable row level security;

create policy private_documents_select on public.private_documents for select to authenticated
  using (
    public.has_perm('financeiro.gerenciar')
    or (entity = 'pagamento' and public.can_view_payment(entity_id))
  );

create policy finance_categories_select on public.finance_categories for select to authenticated
  using (public.has_perm('financeiro.gerenciar'));
create policy finance_categories_insert on public.finance_categories for insert to authenticated
  with check (public.has_perm('financeiro.gerenciar'));
create policy finance_categories_update on public.finance_categories for update to authenticated
  using (public.has_perm('financeiro.gerenciar')) with check (public.has_perm('financeiro.gerenciar'));

create policy finance_entries_select on public.finance_entries for select to authenticated
  using (public.has_perm('financeiro.gerenciar'));
create policy finance_entries_insert on public.finance_entries for insert to authenticated
  with check (public.has_perm('financeiro.gerenciar') and public.camp_is_editable(camp_id));
create policy finance_entries_update on public.finance_entries for update to authenticated
  using (public.has_perm('financeiro.gerenciar') and public.camp_is_editable(camp_id))
  with check (public.has_perm('financeiro.gerenciar') and public.camp_is_editable(camp_id));

create policy finance_budgets_select on public.finance_budgets for select to authenticated
  using (public.has_perm('financeiro.gerenciar'));
create policy finance_budgets_insert on public.finance_budgets for insert to authenticated
  with check (public.has_perm('financeiro.gerenciar') and public.camp_is_editable(camp_id));
create policy finance_budgets_update on public.finance_budgets for update to authenticated
  using (public.has_perm('financeiro.gerenciar') and public.camp_is_editable(camp_id))
  with check (public.has_perm('financeiro.gerenciar') and public.camp_is_editable(camp_id));
create policy finance_budgets_delete on public.finance_budgets for delete to authenticated
  using (public.has_perm('financeiro.gerenciar') and public.camp_is_editable(camp_id));

revoke all on public.private_documents, public.finance_categories, public.finance_entries, public.finance_budgets from anon, authenticated;
grant select on public.private_documents, public.finance_categories, public.finance_entries, public.finance_budgets to authenticated;
grant insert on public.finance_categories, public.finance_entries, public.finance_budgets to authenticated;
grant delete on public.finance_budgets to authenticated;
grant update (name, active, sort) on public.finance_categories to authenticated;
grant update (category_id, team_id, description, amount, entry_date, responsible, notes, cancelled_at, cancelled_by, cancel_reason, updated_by)
  on public.finance_entries to authenticated;
grant update (amount, updated_at, updated_by) on public.finance_budgets to authenticated;
-- Saldo bancário: só pela função set_bank_balance.

-- -----------------------------------------------------------------------------
-- Funções de leitura e de saldo
-- -----------------------------------------------------------------------------

create or replace function public.set_bank_balance(p_amount numeric, p_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_perm('financeiro.gerenciar') then
    perform public.raise_app_error('SEM_PERMISSAO');
  end if;
  if p_amount is not null and abs(p_amount) > 10000000 then
    perform public.raise_app_error('VALOR_INVALIDO');
  end if;
  update public.camps set
    bank_balance = p_amount,
    bank_balance_date = case when p_amount is null then null else coalesce(p_date, (now() at time zone 'America/Sao_Paulo')::date) end,
    bank_balance_by = case when p_amount is null then null else auth.uid() end
  where id = public.active_camp_id();
  perform public.write_audit('BANK_BALANCE', 'camps', public.active_camp_id()::text, public.active_camp_id(), null,
    jsonb_build_object('bank_balance', p_amount, 'bank_balance_date', p_date));
end;
$$;

-- Resumo do financeiro. Receita dos soldados/servos vem só dos pagamentos
-- confirmados nas fichas (sem lançamento manual duplicado).
create or replace function public.finance_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_camp public.camps;
  v_fees numeric;
  v_fees_count int;
  v_income numeric;
  v_expense numeric;
begin
  if not public.has_perm('financeiro.gerenciar') then
    perform public.raise_app_error('SEM_PERMISSAO');
  end if;
  select * into v_camp from public.camps where is_active;
  if v_camp.id is null then
    return null;
  end if;

  select coalesce(sum(payment_paid), 0), count(*) into v_fees, v_fees_count
  from public.service_team_memberships
  where camp_id = v_camp.id and status = 'ativa' and payment_status = 'confirmado';

  select coalesce(sum(amount), 0) into v_income from public.finance_entries
  where camp_id = v_camp.id and kind = 'receita' and cancelled_at is null;
  select coalesce(sum(amount), 0) into v_expense from public.finance_entries
  where camp_id = v_camp.id and kind = 'despesa' and cancelled_at is null;

  return jsonb_build_object(
    'fees', v_fees,
    'fees_count', v_fees_count,
    'other_income', v_income,
    'income', v_fees + v_income,
    'expense', v_expense,
    'balance', v_fees + v_income - v_expense,
    'bank_balance', v_camp.bank_balance,
    'bank_balance_date', v_camp.bank_balance_date,
    'payments', (
      select jsonb_object_agg(s, jsonb_build_object('count', c, 'paid', p, 'expected', e))
      from (
        select payment_status::text s, count(*) c, coalesce(sum(payment_paid), 0) p, coalesce(sum(payment_expected), 0) e
        from public.service_team_memberships
        where camp_id = v_camp.id and status = 'ativa'
        group by payment_status
      ) x
    ),
    'income_by_category', coalesce((
      select jsonb_agg(jsonb_build_object('name', c.name, 'total', t) order by t desc)
      from (
        select category_id, sum(amount) t from public.finance_entries
        where camp_id = v_camp.id and kind = 'receita' and cancelled_at is null
        group by category_id
      ) x join public.finance_categories c on c.id = x.category_id
    ), '[]'::jsonb),
    'expense_by_category', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'total', coalesce(x.t, 0), 'budget', b.amount) order by coalesce(x.t, 0) desc, c.sort)
      from public.finance_categories c
      left join (
        select category_id, sum(amount) t from public.finance_entries
        where camp_id = v_camp.id and kind = 'despesa' and cancelled_at is null
        group by category_id
      ) x on x.category_id = c.id
      left join public.finance_budgets b on b.category_id = c.id and b.camp_id = v_camp.id
      where c.kind = 'despesa' and (x.t is not null or b.amount is not null)
    ), '[]'::jsonb),
    'expense_by_team', coalesce((
      select jsonb_agg(jsonb_build_object('name', coalesce(t.name, 'Geral (sem equipe)'), 'total', x.total) order by x.total desc)
      from (
        select team_id, sum(amount) total from public.finance_entries
        where camp_id = v_camp.id and kind = 'despesa' and cancelled_at is null
        group by team_id
      ) x left join public.service_teams t on t.id = x.team_id
    ), '[]'::jsonb),
    'budget_total', (select coalesce(sum(amount), 0) from public.finance_budgets where camp_id = v_camp.id)
  );
end;
$$;

-- Painel: alerta de pagamentos aguardando conferência (só para o financeiro).
create or replace function public.payments_to_review()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select case when public.has_perm('financeiro.gerenciar') then (
    select count(*)::int from public.service_team_memberships
    where camp_id = public.active_camp_id() and status = 'ativa'
      and payment_status in ('comprovante_enviado', 'em_analise')
  ) else 0 end
$$;

revoke execute on function
  public.can_view_payment(uuid),
  public.register_payment(uuid, numeric, numeric, date, text, text),
  public.set_payment_status(uuid, public.payment_status, text),
  public.set_bank_balance(numeric, date),
  public.finance_summary(),
  public.payments_to_review()
from public, anon;
grant execute on function
  public.can_view_payment(uuid),
  public.register_payment(uuid, numeric, numeric, date, text, text),
  public.set_payment_status(uuid, public.payment_status, text),
  public.set_bank_balance(numeric, date),
  public.finance_summary(),
  public.payments_to_review()
to authenticated;

commit;
