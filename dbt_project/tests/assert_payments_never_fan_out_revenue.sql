-- The fan-out guard, as a test. int_payments_per_order is one row per order, so joining it
-- to the sales fact must not change revenue. If this fails, somebody made the payments model
-- non-unique and every revenue number joined through it is now inflated.
with joined as (
    select round(sum(f.net_amount), 2) as amount
    from {{ ref('fct_order_items') }} f
    left join {{ ref('int_payments_per_order') }} p on p.order_id = f.order_id
),
plain as (select round(sum(net_amount), 2) as amount from {{ ref('fct_order_items') }})
select joined.amount as joined_amount, plain.amount as plain_amount
from joined cross join plain
where abs(joined.amount - plain.amount) > 0.01
