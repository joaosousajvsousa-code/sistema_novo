-- =============================================================================
-- HOLY CAMP · Migração 0008 — Imagem de cada tropa e as 8 tropas do acampamento
-- -----------------------------------------------------------------------------
-- Cada tropa ganha uma imagem (cartão com o tema) e já cria as tropas Jericó,
-- Hebrom, Gileade, Sião, Canaã, Jordão, Carmel e Betel. Se uma tropa com o
-- mesmo nome já existir, só recebe a imagem. Rode no SQL Editor do Supabase
-- (projeto sistema_holy), depois da 0007.
-- =============================================================================

begin;

alter table public.participant_groups
  add column if not exists image text
  check (image is null or image in ('jerico', 'hebrom', 'gileade', 'siao', 'canaa', 'jordao', 'carmel', 'betel'));

grant update (image) on public.participant_groups to authenticated;

-- A visão passa a trazer a imagem.
drop view if exists public.participant_groups_overview;
create view public.participant_groups_overview
with (security_invoker = on) as
select g.*, public.group_occupancy(g.id) as occupied
from public.participant_groups g;
grant select on public.participant_groups_overview to authenticated;

-- As 8 tropas, em todo acampamento que não está arquivado.
do $$
declare
  c record;
  t record;
begin
  for c in select id from public.camps where status <> 'arquivado' loop
    for t in
      select * from (values
        ('Tropa Jericó', 'jerico'),
        ('Tropa Hebrom', 'hebrom'),
        ('Tropa Gileade', 'gileade'),
        ('Tropa Sião', 'siao'),
        ('Tropa Canaã', 'canaa'),
        ('Tropa Jordão', 'jordao'),
        ('Tropa Carmel', 'carmel'),
        ('Tropa Betel', 'betel')
      ) as v(name, image)
    loop
      update public.participant_groups
        set image = t.image
        where camp_id = c.id
          and public.normalize_text(name) in (public.normalize_text(t.name), public.normalize_text(substr(t.name, 7)));
      if not found then
        insert into public.participant_groups (camp_id, name, image) values (c.id, t.name, t.image);
      end if;
    end loop;
  end loop;
end;
$$;

commit;
