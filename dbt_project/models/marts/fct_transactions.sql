-- GRAIN: one row per payment attempt. Approvals, declines and refunds all live here, and
-- amount is signed so SUM over approved plus refunded is net settled money.
with txns as (select * from {{ ref('stg_bazaar__transactions') }}),
     orders as (select * from {{ ref('stg_bazaar__orders') }}),
     dim_users as (select * from {{ ref('dim_users') }}),
     dim_methods as (select * from {{ ref('dim_payment_methods') }}),
     dim_dates as (select * from {{ ref('dim_dates') }})

select
    {{ surrogate_key(['txns.txn_id']) }}      as txn_sk,

    coalesce(dim_dates.date_key, '-1')        as date_key,
    hour(txns.attempted_at)                   as time_key,
    coalesce(dim_users.user_sk, '-1')         as user_sk,
    coalesce(dim_methods.payment_method_sk, '-1') as payment_method_sk,

    txns.txn_id,                               -- degenerate
    txns.order_id,                             -- degenerate, the drill-down path

    txns.amount                               as attempt_amount,
    txns.approved_amount,
    txns.declined_amount,
    txns.is_approved,
    txns.is_declined,
    txns.is_refund,
    txns.decline_reason
from txns
join orders on orders.order_id = txns.order_id
left join dim_dates   on dim_dates.date_day = cast(txns.attempted_at as date)
left join dim_users   on dim_users.user_id = orders.user_id
left join dim_methods on dim_methods.payment_method = txns.payment_method
