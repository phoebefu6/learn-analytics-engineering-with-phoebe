-- Payment attempts aggregated to ONE row per order. This model exists so that no mart ever
-- joins the payments fact to the sales fact directly: aggregate first, then join. It is the
-- fan-out guard, expressed as a model instead of as a warning in a wiki.
with txns as (select * from {{ ref('stg_bazaar__transactions') }})

select
    order_id,
    count(*)                        as payment_attempts,
    sum(is_approved)                as approvals,
    sum(is_declined)                as declines,
    sum(is_refund)                  as refunds,
    round(sum(approved_amount), 2)  as approved_amount,
    round(sum(declined_amount), 2)  as declined_amount,
    min(attempted_at)               as first_attempt_at,
    max(attempted_at)               as last_attempt_at
from txns
group by order_id
