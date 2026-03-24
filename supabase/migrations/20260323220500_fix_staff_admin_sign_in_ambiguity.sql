create or replace function public.staff_admin_sign_in(
  input_email text,
  input_password text
)
returns table (
  admin_id uuid,
  email text,
  display_name text,
  session_token text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_record public.staff_admin_accounts%rowtype;
  plain_token text;
begin
  select account.*
  into admin_record
  from public.staff_admin_accounts as account
  where account.email = lower(trim(coalesce(input_email, '')))
    and account.is_active = true
  limit 1;

  if not found then
    raise exception 'Invalid admin credentials.'
      using errcode = '28000';
  end if;

  if crypt(coalesce(input_password, ''), admin_record.password_hash) <> admin_record.password_hash then
    raise exception 'Invalid admin credentials.'
      using errcode = '28000';
  end if;

  plain_token := encode(gen_random_bytes(32), 'hex');

  insert into public.staff_admin_sessions (
    admin_id,
    token_hash,
    expires_at
  )
  values (
    admin_record.id,
    encode(digest(plain_token, 'sha256'), 'hex'),
    timezone('utc', now()) + interval '30 days'
  );

  return query
  select
    admin_record.id,
    admin_record.email,
    admin_record.display_name,
    plain_token;
end;
$$;
