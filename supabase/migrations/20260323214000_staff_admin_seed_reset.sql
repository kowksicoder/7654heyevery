insert into public.staff_admin_accounts (
  email,
  display_name,
  password_hash,
  is_active
)
values
  (
    'bloombetgaming@gmail.com',
    'BloomBet Admin',
    crypt('@Admin1234', gen_salt('bf')),
    true
  ),
  (
    'oxplaymedia@gmail.com',
    'OxPlay Admin',
    crypt('@Admin1234', gen_salt('bf')),
    true
  )
on conflict (email) do update
set
  display_name = excluded.display_name,
  password_hash = excluded.password_hash,
  is_active = true,
  updated_at = timezone('utc', now());
