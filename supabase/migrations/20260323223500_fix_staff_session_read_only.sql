create or replace function public.get_staff_admin_session(
  input_session_token text
)
returns table (
  admin_id uuid,
  email text,
  display_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_token text := nullif(trim(input_session_token), '');
  session_hash text;
begin
  if normalized_token is null then
    raise exception 'Admin session required.'
      using errcode = '42501';
  end if;

  session_hash := encode(extensions.digest(normalized_token, 'sha256'), 'hex');

  return query
  select
    admin.id,
    admin.email,
    admin.display_name
  from public.staff_admin_sessions session
  inner join public.staff_admin_accounts admin
    on admin.id = session.admin_id
  where session.token_hash = session_hash
    and session.revoked_at is null
    and session.expires_at > timezone('utc', now())
    and admin.is_active = true
  limit 1;

  if not found then
    raise exception 'Invalid admin session.'
      using errcode = '42501';
  end if;
end;
$$;
