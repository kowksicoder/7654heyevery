do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'fiat_quote_status'
  ) then
    create type public.fiat_quote_status as enum (
      'quoted',
      'awaiting_confirmation',
      'consumed',
      'expired',
      'cancelled'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'support_transaction_status'
  ) then
    create type public.support_transaction_status as enum (
      'quoted',
      'awaiting_confirmation',
      'processing',
      'completed',
      'failed'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'sell_transaction_status'
  ) then
    create type public.sell_transaction_status as enum (
      'quoted',
      'processing',
      'completed',
      'failed'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'withdrawal_status'
  ) then
    create type public.withdrawal_status as enum (
      'pending',
      'processing',
      'completed',
      'failed'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'fiat_ledger_entry_kind'
  ) then
    create type public.fiat_ledger_entry_kind as enum (
      'deposit_pending',
      'deposit_settled',
      'deposit_failed',
      'support_hold',
      'support_commit',
      'support_release',
      'support_refund',
      'sell_pending',
      'sell_settled',
      'sell_failed',
      'withdrawal_hold',
      'withdrawal_commit',
      'withdrawal_release',
      'withdrawal_refund',
      'adjustment'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'payout_provider'
  ) then
    create type public.payout_provider as enum (
      'flutterwave'
    );
  end if;
end
$$;

create table if not exists public.fiat_wallets (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  currency text not null default 'NGN',
  available_balance_kobo bigint not null default 0,
  pending_balance_kobo bigint not null default 0,
  locked_balance_kobo bigint not null default 0,
  last_transaction_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint fiat_wallets_currency_format check (
    currency ~ '^[A-Z]{3}$'
  ),
  constraint fiat_wallets_available_non_negative check (
    available_balance_kobo >= 0
  ),
  constraint fiat_wallets_pending_non_negative check (
    pending_balance_kobo >= 0
  ),
  constraint fiat_wallets_locked_non_negative check (
    locked_balance_kobo >= 0
  )
);

create index if not exists fiat_wallets_profile_idx
  on public.fiat_wallets (profile_id, updated_at desc);

create table if not exists public.fiat_wallet_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.fiat_wallets (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  entry_kind public.fiat_ledger_entry_kind not null,
  reference_kind text not null,
  reference_id uuid,
  available_delta_kobo bigint not null default 0,
  pending_delta_kobo bigint not null default 0,
  locked_delta_kobo bigint not null default 0,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint fiat_wallet_ledger_entries_delta_not_zero check (
    available_delta_kobo <> 0
    or pending_delta_kobo <> 0
    or locked_delta_kobo <> 0
  )
);

create unique index if not exists fiat_wallet_ledger_entries_reference_unique_idx
  on public.fiat_wallet_ledger_entries (reference_kind, reference_id, entry_kind)
  where reference_id is not null;

create index if not exists fiat_wallet_ledger_entries_profile_idx
  on public.fiat_wallet_ledger_entries (profile_id, created_at desc);

create index if not exists fiat_wallet_ledger_entries_wallet_idx
  on public.fiat_wallet_ledger_entries (wallet_id, created_at desc);

create table if not exists public.fiat_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  provider public.payout_provider not null default 'flutterwave',
  bank_code text not null,
  bank_name text not null,
  account_number text not null,
  account_name text,
  provider_recipient_id text,
  is_default boolean not null default false,
  is_verified boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint fiat_bank_accounts_bank_code_length check (
    char_length(trim(bank_code)) between 2 and 32
  ),
  constraint fiat_bank_accounts_bank_name_length check (
    char_length(trim(bank_name)) between 2 and 120
  ),
  constraint fiat_bank_accounts_account_number_format check (
    account_number ~ '^[0-9]{6,20}$'
  )
);

create unique index if not exists fiat_bank_accounts_profile_account_unique_idx
  on public.fiat_bank_accounts (profile_id, provider, bank_code, account_number);

create index if not exists fiat_bank_accounts_profile_idx
  on public.fiat_bank_accounts (profile_id, is_default desc, updated_at desc);

create table if not exists public.support_quotes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  creator_profile_id uuid references public.profiles (id) on delete set null,
  creator_launch_id uuid references public.creator_launches (id) on delete set null,
  coin_address text not null,
  coin_symbol text,
  naira_amount_kobo bigint not null,
  fee_kobo bigint not null default 0,
  total_kobo bigint not null,
  estimated_coin_amount numeric(30, 10) not null default 0,
  estimated_coin_amount_raw text,
  status public.fiat_quote_status not null default 'quoted',
  expires_at timestamptz not null,
  source_snapshot jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  consumed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint support_quotes_coin_address_format check (
    coin_address ~* '^0x[a-f0-9]{40}$'
  ),
  constraint support_quotes_amount_positive check (
    naira_amount_kobo > 0
  ),
  constraint support_quotes_fee_non_negative check (
    fee_kobo >= 0
  ),
  constraint support_quotes_total_positive check (
    total_kobo > 0
  ),
  constraint support_quotes_total_floor check (
    total_kobo >= naira_amount_kobo
  )
);

create index if not exists support_quotes_profile_idx
  on public.support_quotes (profile_id, status, created_at desc);

create index if not exists support_quotes_coin_idx
  on public.support_quotes (coin_address, created_at desc);

create table if not exists public.sell_quotes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  creator_profile_id uuid references public.profiles (id) on delete set null,
  creator_launch_id uuid references public.creator_launches (id) on delete set null,
  coin_address text not null,
  coin_symbol text,
  coin_amount numeric(30, 10) not null,
  coin_amount_raw text,
  estimated_naira_return_kobo bigint not null,
  fee_kobo bigint not null default 0,
  net_naira_return_kobo bigint not null,
  status public.fiat_quote_status not null default 'quoted',
  expires_at timestamptz not null,
  source_snapshot jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  consumed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint sell_quotes_coin_address_format check (
    coin_address ~* '^0x[a-f0-9]{40}$'
  ),
  constraint sell_quotes_coin_amount_positive check (
    coin_amount > 0
  ),
  constraint sell_quotes_return_positive check (
    estimated_naira_return_kobo >= 0
  ),
  constraint sell_quotes_fee_non_negative check (
    fee_kobo >= 0
  ),
  constraint sell_quotes_net_return_non_negative check (
    net_naira_return_kobo >= 0
  )
);

create index if not exists sell_quotes_profile_idx
  on public.sell_quotes (profile_id, status, created_at desc);

create index if not exists sell_quotes_coin_idx
  on public.sell_quotes (coin_address, created_at desc);

create table if not exists public.support_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.fiat_wallets (id) on delete restrict,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  quote_id uuid unique references public.support_quotes (id) on delete set null,
  creator_profile_id uuid references public.profiles (id) on delete set null,
  creator_launch_id uuid references public.creator_launches (id) on delete set null,
  coin_address text not null,
  coin_symbol text,
  status public.support_transaction_status not null default 'quoted',
  naira_amount_kobo bigint not null,
  fee_kobo bigint not null default 0,
  total_kobo bigint not null,
  estimated_coin_amount numeric(30, 10) not null default 0,
  estimated_coin_amount_raw text,
  idempotency_key text,
  zora_trade_hash text,
  error_code text,
  error_message text,
  quote_expires_at timestamptz,
  confirmed_at timestamptz,
  processing_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint support_transactions_coin_address_format check (
    coin_address ~* '^0x[a-f0-9]{40}$'
  ),
  constraint support_transactions_amount_positive check (
    naira_amount_kobo > 0
  ),
  constraint support_transactions_fee_non_negative check (
    fee_kobo >= 0
  ),
  constraint support_transactions_total_positive check (
    total_kobo > 0
  )
);

create index if not exists support_transactions_profile_idx
  on public.support_transactions (profile_id, status, created_at desc);

create index if not exists support_transactions_coin_idx
  on public.support_transactions (coin_address, created_at desc);

create index if not exists support_transactions_wallet_idx
  on public.support_transactions (wallet_id, created_at desc);

create table if not exists public.sell_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.fiat_wallets (id) on delete restrict,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  quote_id uuid unique references public.sell_quotes (id) on delete set null,
  creator_profile_id uuid references public.profiles (id) on delete set null,
  creator_launch_id uuid references public.creator_launches (id) on delete set null,
  coin_address text not null,
  coin_symbol text,
  status public.sell_transaction_status not null default 'quoted',
  coin_amount numeric(30, 10) not null,
  coin_amount_raw text,
  estimated_naira_return_kobo bigint not null,
  fee_kobo bigint not null default 0,
  net_naira_return_kobo bigint not null,
  credited_naira_kobo bigint not null default 0,
  idempotency_key text,
  zora_trade_hash text,
  error_code text,
  error_message text,
  completed_at timestamptz,
  failed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint sell_transactions_coin_address_format check (
    coin_address ~* '^0x[a-f0-9]{40}$'
  ),
  constraint sell_transactions_coin_amount_positive check (
    coin_amount > 0
  ),
  constraint sell_transactions_return_non_negative check (
    estimated_naira_return_kobo >= 0
  ),
  constraint sell_transactions_fee_non_negative check (
    fee_kobo >= 0
  ),
  constraint sell_transactions_net_non_negative check (
    net_naira_return_kobo >= 0
  ),
  constraint sell_transactions_credit_non_negative check (
    credited_naira_kobo >= 0
  )
);

create index if not exists sell_transactions_profile_idx
  on public.sell_transactions (profile_id, status, created_at desc);

create index if not exists sell_transactions_coin_idx
  on public.sell_transactions (coin_address, created_at desc);

create index if not exists sell_transactions_wallet_idx
  on public.sell_transactions (wallet_id, created_at desc);

create table if not exists public.fiat_withdrawals (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.fiat_wallets (id) on delete restrict,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  bank_account_id uuid not null references public.fiat_bank_accounts (id) on delete restrict,
  provider public.payout_provider not null default 'flutterwave',
  provider_payout_id text,
  status public.withdrawal_status not null default 'pending',
  amount_kobo bigint not null,
  fee_kobo bigint not null default 0,
  net_amount_kobo bigint not null,
  idempotency_key text,
  reference text,
  failure_code text,
  failure_reason text,
  requested_at timestamptz not null default timezone('utc', now()),
  processing_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint fiat_withdrawals_amount_positive check (
    amount_kobo > 0
  ),
  constraint fiat_withdrawals_fee_non_negative check (
    fee_kobo >= 0
  ),
  constraint fiat_withdrawals_net_positive check (
    net_amount_kobo > 0
  ),
  constraint fiat_withdrawals_net_floor check (
    amount_kobo >= net_amount_kobo
  )
);

create index if not exists fiat_withdrawals_profile_idx
  on public.fiat_withdrawals (profile_id, status, requested_at desc);

create index if not exists fiat_withdrawals_wallet_idx
  on public.fiat_withdrawals (wallet_id, requested_at desc);

create table if not exists public.payout_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider public.payout_provider not null default 'flutterwave',
  provider_event_id text,
  event_type text not null,
  signature text,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists payout_webhook_events_provider_event_unique_idx
  on public.payout_webhook_events (provider, provider_event_id)
  where provider_event_id is not null;

create table if not exists public.fiat_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  profile_id uuid references public.profiles (id) on delete cascade,
  idempotency_key text not null,
  request_hash text,
  response_status integer,
  response_body jsonb,
  locked_at timestamptz,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint fiat_idempotency_keys_scope_length check (
    char_length(trim(scope)) between 3 and 120
  ),
  constraint fiat_idempotency_keys_key_length check (
    char_length(trim(idempotency_key)) between 8 and 160
  )
);

create unique index if not exists fiat_idempotency_keys_scope_key_unique_idx
  on public.fiat_idempotency_keys (scope, idempotency_key);

create index if not exists fiat_idempotency_keys_profile_idx
  on public.fiat_idempotency_keys (profile_id, created_at desc);

alter table public.payment_transactions
  add column if not exists checkout_url text,
  add column if not exists checkout_expires_at timestamptz,
  add column if not exists callback_url text,
  add column if not exists customer_email text,
  add column if not exists customer_name text,
  add column if not exists customer_phone text,
  add column if not exists idempotency_key text;

create index if not exists payment_transactions_purpose_status_idx
  on public.payment_transactions (purpose, status, created_at desc);

create or replace function public.ensure_fiat_wallet(input_profile_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  ensured_wallet_id uuid;
begin
  if input_profile_id is null then
    raise exception 'A profile id is required to ensure a fiat wallet.';
  end if;

  insert into public.fiat_wallets (profile_id)
  values (input_profile_id)
  on conflict (profile_id) do nothing;

  select wallet.id
  into ensured_wallet_id
  from public.fiat_wallets wallet
  where wallet.profile_id = input_profile_id;

  if ensured_wallet_id is null then
    raise exception 'Failed to ensure fiat wallet for profile %.', input_profile_id;
  end if;

  return ensured_wallet_id;
end;
$$;

create or replace function public.hydrate_fiat_wallet_ledger_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wallet_row public.fiat_wallets%rowtype;
begin
  if new.profile_id is null and new.wallet_id is null then
    raise exception 'A wallet or profile id is required for fiat ledger entries.';
  end if;

  if new.profile_id is not null and new.wallet_id is null then
    new.wallet_id := public.ensure_fiat_wallet(new.profile_id);
  end if;

  select *
  into wallet_row
  from public.fiat_wallets wallet
  where wallet.id = new.wallet_id
  for update;

  if wallet_row.id is null then
    raise exception 'Fiat wallet % was not found.', new.wallet_id;
  end if;

  if new.profile_id is null then
    new.profile_id := wallet_row.profile_id;
  elsif new.profile_id <> wallet_row.profile_id then
    raise exception 'Fiat ledger profile % does not match wallet owner %.', new.profile_id, wallet_row.profile_id;
  end if;

  if wallet_row.available_balance_kobo + new.available_delta_kobo < 0 then
    raise exception 'Available fiat balance cannot go negative.';
  end if;

  if wallet_row.pending_balance_kobo + new.pending_delta_kobo < 0 then
    raise exception 'Pending fiat balance cannot go negative.';
  end if;

  if wallet_row.locked_balance_kobo + new.locked_delta_kobo < 0 then
    raise exception 'Locked fiat balance cannot go negative.';
  end if;

  new.created_at := coalesce(new.created_at, timezone('utc', now()));
  return new;
end;
$$;

create or replace function public.apply_fiat_wallet_ledger_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.fiat_wallets
  set
    available_balance_kobo = available_balance_kobo + new.available_delta_kobo,
    pending_balance_kobo = pending_balance_kobo + new.pending_delta_kobo,
    locked_balance_kobo = locked_balance_kobo + new.locked_delta_kobo,
    last_transaction_at = greatest(
      coalesce(last_transaction_at, new.created_at),
      new.created_at
    )
  where id = new.wallet_id;

  return new;
end;
$$;

create or replace function public.credit_fiat_wallet_from_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wallet_id uuid;
  amount_kobo bigint;
begin
  if new.purpose <> 'fiat_wallet_deposit' then
    return new;
  end if;

  if new.status <> 'succeeded' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'succeeded' then
    return new;
  end if;

  wallet_id := public.ensure_fiat_wallet(new.profile_id);
  amount_kobo := round(coalesce(new.amount, 0) * 100)::bigint;

  if amount_kobo <= 0 then
    return new;
  end if;

  insert into public.fiat_wallet_ledger_entries (
    wallet_id,
    profile_id,
    entry_kind,
    reference_kind,
    reference_id,
    available_delta_kobo,
    description,
    metadata
  )
  select
    wallet_id,
    new.profile_id,
    'deposit_settled',
    'payment_transaction',
    new.id,
    amount_kobo,
    'Fiat wallet deposit settled',
    jsonb_build_object(
      'checkoutReference',
      new.checkout_reference,
      'currency',
      new.currency,
      'provider',
      new.provider,
      'providerTransactionId',
      new.provider_transaction_id
    )
  where not exists (
    select 1
    from public.fiat_wallet_ledger_entries ledger
    where ledger.reference_kind = 'payment_transaction'
      and ledger.reference_id = new.id
      and ledger.entry_kind = 'deposit_settled'
  );

  return new;
end;
$$;

create or replace function public.get_fiat_wallet_overview(input_profile_id uuid)
returns table (
  wallet_id uuid,
  profile_id uuid,
  currency text,
  available_balance_kobo bigint,
  pending_balance_kobo bigint,
  locked_balance_kobo bigint,
  total_balance_kobo bigint,
  last_transaction_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  ensured_wallet_id uuid;
begin
  ensured_wallet_id := public.ensure_fiat_wallet(input_profile_id);

  return query
  select
    wallet.id,
    wallet.profile_id,
    wallet.currency,
    wallet.available_balance_kobo,
    wallet.pending_balance_kobo,
    wallet.locked_balance_kobo,
    wallet.available_balance_kobo
      + wallet.pending_balance_kobo
      + wallet.locked_balance_kobo as total_balance_kobo,
    wallet.last_transaction_at
  from public.fiat_wallets wallet
  where wallet.id = ensured_wallet_id;
end;
$$;

create or replace function public.list_fiat_wallet_transactions(
  input_profile_id uuid,
  input_limit integer default 50
)
returns table (
  transaction_id uuid,
  transaction_type text,
  status text,
  direction text,
  title text,
  subtitle text,
  amount_kobo bigint,
  fee_kobo bigint,
  net_amount_kobo bigint,
  coin_address text,
  coin_symbol text,
  created_at timestamptz,
  updated_at timestamptz,
  metadata jsonb
)
language sql
security definer
set search_path = public
as $$
  with deposit_rows as (
    select
      payment.id as transaction_id,
      'deposit'::text as transaction_type,
      payment.status::text as status,
      'credit'::text as direction,
      'Wallet deposit'::text as title,
      coalesce(payment.metadata->>'providerLabel', payment.checkout_reference) as subtitle,
      round(payment.amount * 100)::bigint as amount_kobo,
      round(payment.fee_amount * 100)::bigint as fee_kobo,
      round((payment.amount - payment.fee_amount) * 100)::bigint as net_amount_kobo,
      null::text as coin_address,
      null::text as coin_symbol,
      payment.created_at,
      payment.updated_at,
      payment.metadata
    from public.payment_transactions payment
    where payment.profile_id = input_profile_id
      and payment.purpose = 'fiat_wallet_deposit'
  ),
  support_rows as (
    select
      support.id as transaction_id,
      'support'::text as transaction_type,
      support.status::text as status,
      'debit'::text as direction,
      'Support creator'::text as title,
      coalesce(support.coin_symbol, support.coin_address) as subtitle,
      support.total_kobo as amount_kobo,
      support.fee_kobo,
      support.naira_amount_kobo as net_amount_kobo,
      support.coin_address,
      support.coin_symbol,
      support.created_at,
      support.updated_at,
      support.metadata
    from public.support_transactions support
    where support.profile_id = input_profile_id
  ),
  sell_rows as (
    select
      sell.id as transaction_id,
      'sell'::text as transaction_type,
      sell.status::text as status,
      'credit'::text as direction,
      'Sell creator coin'::text as title,
      coalesce(sell.coin_symbol, sell.coin_address) as subtitle,
      sell.estimated_naira_return_kobo as amount_kobo,
      sell.fee_kobo,
      sell.net_naira_return_kobo as net_amount_kobo,
      sell.coin_address,
      sell.coin_symbol,
      sell.created_at,
      sell.updated_at,
      sell.metadata
    from public.sell_transactions sell
    where sell.profile_id = input_profile_id
  ),
  withdrawal_rows as (
    select
      withdrawal.id as transaction_id,
      'withdrawal'::text as transaction_type,
      withdrawal.status::text as status,
      'debit'::text as direction,
      'Withdraw to bank'::text as title,
      concat(bank.bank_name, ' - ', right(bank.account_number, 4)) as subtitle,
      withdrawal.amount_kobo,
      withdrawal.fee_kobo,
      withdrawal.net_amount_kobo,
      null::text as coin_address,
      null::text as coin_symbol,
      withdrawal.created_at,
      withdrawal.updated_at,
      withdrawal.metadata
    from public.fiat_withdrawals withdrawal
    join public.fiat_bank_accounts bank
      on bank.id = withdrawal.bank_account_id
    where withdrawal.profile_id = input_profile_id
  )
  select *
  from (
    select * from deposit_rows
    union all
    select * from support_rows
    union all
    select * from sell_rows
    union all
    select * from withdrawal_rows
  ) all_rows
  order by created_at desc, transaction_id desc
  limit greatest(coalesce(input_limit, 50), 1);
$$;

drop trigger if exists fiat_wallets_set_updated_at on public.fiat_wallets;
create trigger fiat_wallets_set_updated_at
  before update on public.fiat_wallets
  for each row
  execute function public.set_updated_at();

drop trigger if exists fiat_bank_accounts_set_updated_at on public.fiat_bank_accounts;
create trigger fiat_bank_accounts_set_updated_at
  before update on public.fiat_bank_accounts
  for each row
  execute function public.set_updated_at();

drop trigger if exists support_quotes_set_updated_at on public.support_quotes;
create trigger support_quotes_set_updated_at
  before update on public.support_quotes
  for each row
  execute function public.set_updated_at();

drop trigger if exists sell_quotes_set_updated_at on public.sell_quotes;
create trigger sell_quotes_set_updated_at
  before update on public.sell_quotes
  for each row
  execute function public.set_updated_at();

drop trigger if exists support_transactions_set_updated_at on public.support_transactions;
create trigger support_transactions_set_updated_at
  before update on public.support_transactions
  for each row
  execute function public.set_updated_at();

drop trigger if exists sell_transactions_set_updated_at on public.sell_transactions;
create trigger sell_transactions_set_updated_at
  before update on public.sell_transactions
  for each row
  execute function public.set_updated_at();

drop trigger if exists fiat_withdrawals_set_updated_at on public.fiat_withdrawals;
create trigger fiat_withdrawals_set_updated_at
  before update on public.fiat_withdrawals
  for each row
  execute function public.set_updated_at();

drop trigger if exists fiat_idempotency_keys_set_updated_at on public.fiat_idempotency_keys;
create trigger fiat_idempotency_keys_set_updated_at
  before update on public.fiat_idempotency_keys
  for each row
  execute function public.set_updated_at();

drop trigger if exists hydrate_fiat_wallet_ledger_entry on public.fiat_wallet_ledger_entries;
create trigger hydrate_fiat_wallet_ledger_entry
  before insert on public.fiat_wallet_ledger_entries
  for each row
  execute function public.hydrate_fiat_wallet_ledger_entry();

drop trigger if exists apply_fiat_wallet_ledger_entry on public.fiat_wallet_ledger_entries;
create trigger apply_fiat_wallet_ledger_entry
  after insert on public.fiat_wallet_ledger_entries
  for each row
  execute function public.apply_fiat_wallet_ledger_entry();

drop trigger if exists payment_transactions_credit_fiat_wallet on public.payment_transactions;
create trigger payment_transactions_credit_fiat_wallet
  after insert or update of status on public.payment_transactions
  for each row
  execute function public.credit_fiat_wallet_from_payment();

alter table public.fiat_wallets enable row level security;
alter table public.fiat_wallet_ledger_entries enable row level security;
alter table public.fiat_bank_accounts enable row level security;
alter table public.support_quotes enable row level security;
alter table public.sell_quotes enable row level security;
alter table public.support_transactions enable row level security;
alter table public.sell_transactions enable row level security;
alter table public.fiat_withdrawals enable row level security;
alter table public.payout_webhook_events enable row level security;
alter table public.fiat_idempotency_keys enable row level security;

drop policy if exists "fiat_wallets_select_self" on public.fiat_wallets;
create policy "fiat_wallets_select_self"
  on public.fiat_wallets
  for select
  to authenticated
  using (auth.uid() = profile_id);

drop policy if exists "fiat_wallet_ledger_entries_select_self" on public.fiat_wallet_ledger_entries;
create policy "fiat_wallet_ledger_entries_select_self"
  on public.fiat_wallet_ledger_entries
  for select
  to authenticated
  using (auth.uid() = profile_id);

drop policy if exists "fiat_bank_accounts_select_self" on public.fiat_bank_accounts;
create policy "fiat_bank_accounts_select_self"
  on public.fiat_bank_accounts
  for select
  to authenticated
  using (auth.uid() = profile_id);

drop policy if exists "fiat_bank_accounts_insert_self" on public.fiat_bank_accounts;
create policy "fiat_bank_accounts_insert_self"
  on public.fiat_bank_accounts
  for insert
  to authenticated
  with check (auth.uid() = profile_id);

drop policy if exists "fiat_bank_accounts_update_self" on public.fiat_bank_accounts;
create policy "fiat_bank_accounts_update_self"
  on public.fiat_bank_accounts
  for update
  to authenticated
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

drop policy if exists "support_quotes_select_self" on public.support_quotes;
create policy "support_quotes_select_self"
  on public.support_quotes
  for select
  to authenticated
  using (auth.uid() = profile_id);

drop policy if exists "support_quotes_insert_self" on public.support_quotes;
create policy "support_quotes_insert_self"
  on public.support_quotes
  for insert
  to authenticated
  with check (auth.uid() = profile_id);

drop policy if exists "sell_quotes_select_self" on public.sell_quotes;
create policy "sell_quotes_select_self"
  on public.sell_quotes
  for select
  to authenticated
  using (auth.uid() = profile_id);

drop policy if exists "sell_quotes_insert_self" on public.sell_quotes;
create policy "sell_quotes_insert_self"
  on public.sell_quotes
  for insert
  to authenticated
  with check (auth.uid() = profile_id);

drop policy if exists "support_transactions_select_self" on public.support_transactions;
create policy "support_transactions_select_self"
  on public.support_transactions
  for select
  to authenticated
  using (auth.uid() = profile_id);

drop policy if exists "support_transactions_insert_self" on public.support_transactions;
create policy "support_transactions_insert_self"
  on public.support_transactions
  for insert
  to authenticated
  with check (auth.uid() = profile_id);

drop policy if exists "sell_transactions_select_self" on public.sell_transactions;
create policy "sell_transactions_select_self"
  on public.sell_transactions
  for select
  to authenticated
  using (auth.uid() = profile_id);

drop policy if exists "sell_transactions_insert_self" on public.sell_transactions;
create policy "sell_transactions_insert_self"
  on public.sell_transactions
  for insert
  to authenticated
  with check (auth.uid() = profile_id);

drop policy if exists "fiat_withdrawals_select_self" on public.fiat_withdrawals;
create policy "fiat_withdrawals_select_self"
  on public.fiat_withdrawals
  for select
  to authenticated
  using (auth.uid() = profile_id);

drop policy if exists "fiat_withdrawals_insert_self" on public.fiat_withdrawals;
create policy "fiat_withdrawals_insert_self"
  on public.fiat_withdrawals
  for insert
  to authenticated
  with check (auth.uid() = profile_id);

grant select on public.fiat_wallets to authenticated;
grant select on public.fiat_wallet_ledger_entries to authenticated;

grant select, insert, update on public.fiat_bank_accounts to authenticated;

grant select, insert on public.support_quotes to authenticated;
grant select, insert on public.sell_quotes to authenticated;
grant select, insert on public.support_transactions to authenticated;
grant select, insert on public.sell_transactions to authenticated;
grant select, insert on public.fiat_withdrawals to authenticated;

grant execute on function public.ensure_fiat_wallet(uuid) to authenticated;
grant execute on function public.get_fiat_wallet_overview(uuid) to authenticated;
grant execute on function public.list_fiat_wallet_transactions(uuid, integer) to authenticated;

comment on table public.fiat_wallets is
  'Snapshot fiat wallet balances for Every1 users, stored in kobo and derived from the immutable fiat wallet ledger.';

comment on table public.fiat_wallet_ledger_entries is
  'Immutable fiat ledger entries that move value across available, pending, and locked buckets for deposits, supports, sells, withdrawals, and adjustments.';

comment on table public.fiat_bank_accounts is
  'Saved payout destinations for bank withdrawals from the Every1 fiat wallet experience.';

comment on table public.support_quotes is
  'Frontend-friendly support quote records that convert a Naira support amount into an estimated creator coin amount before execution.';

comment on table public.sell_quotes is
  'Frontend-friendly sell quote records that convert a creator coin amount into an estimated Naira return before execution.';

comment on table public.support_transactions is
  'Support transaction lifecycle records for the Naira-first creator support flow backed by creator coin buys.';

comment on table public.sell_transactions is
  'Sell transaction lifecycle records for the Naira-first creator sell flow backed by creator coin sells.';

comment on table public.fiat_withdrawals is
  'Bank withdrawal lifecycle records for Every1 fiat wallet payouts.';

comment on table public.payout_webhook_events is
  'Raw payout webhook audit log for withdrawal provider callbacks and reconciliation.';

comment on table public.fiat_idempotency_keys is
  'Idempotency registry for fiat wallet, support, sell, withdrawal, and webhook actions.';

comment on function public.get_fiat_wallet_overview(uuid) is
  'Returns the fiat wallet snapshot for a profile, ensuring the wallet exists first.';

comment on function public.list_fiat_wallet_transactions(uuid, integer) is
  'Returns a frontend-friendly fiat wallet transaction feed across deposits, supports, sells, and withdrawals.';
