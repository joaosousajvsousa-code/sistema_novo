-- =============================================================================
-- HOLY CAMP · Migração 0009 — Foto dos recrutas
-- -----------------------------------------------------------------------------
-- Foto de cada recruta num bucket PRIVADO ("fotos"). A imagem só sai pelo
-- sistema, para quem pode ver os recrutas. Rode no SQL Editor do Supabase
-- (projeto sistema_holy), depois da 0008.
-- =============================================================================

begin;

alter table public.encontristas add column if not exists photo_path text
  check (photo_path is null or char_length(photo_path) <= 300);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Lista de recrutas com a foto.
drop view if exists public.encontristas_list;
create view public.encontristas_list
with (security_invoker = on) as
select
  e.id, e.camp_id, e.status, e.shirt_size, e.created_at, e.person_id,
  p.full_name, p.name_normalized, p.phone, p.birth_date,
  a.group_id, g.name as group_name,
  e.attendance_status, e.attendance_at,
  e.photo_path
from public.encontristas e
join public.people p on p.id = e.person_id
left join public.participant_group_assignments a on a.encontrista_id = e.id
left join public.participant_groups g on g.id = a.group_id;
grant select on public.encontristas_list to authenticated;

-- Tela de presença com a foto (ajuda a reconhecer o recruta).
drop function if exists public.attendance_list(text, uuid, text);
create or replace function public.attendance_list(p_q text default null, p_group uuid default null, p_status text default null)
returns table (
  id uuid, full_name text, phone text, group_id uuid, group_name text, shirt_size text,
  attendance_status public.attendance_status, attendance_at timestamptz, attendance_by_name text,
  photo_path text
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
      a.group_id, g.name, e.shirt_size, e.attendance_status, e.attendance_at, pr.full_name, e.photo_path
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

revoke execute on function public.attendance_list(text, uuid, text) from public, anon;
grant execute on function public.attendance_list(text, uuid, text) to authenticated;

commit;
