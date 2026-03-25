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
      'Buy creator coin'::text as title,
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
