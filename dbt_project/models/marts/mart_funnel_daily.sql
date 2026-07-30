-- GRAIN: one day. The decomposition mart: sales = carts x conversion x AOV, so a drop is
-- always one of those three moving and the arithmetic is checkable in one place.
-- Note it joins three PRE-AGGREGATED day-grain sets, never two facts directly.
with carts as (
    select dates.date_day as activity_date,
           count(*) as carts_created,
           sum(case when c.is_converted then 1 else 0 end) as carts_converted,
           round(sum(c.cart_value), 2) as cart_value,
           round(sum(c.abandoned_value), 2) as abandoned_value
    from {{ ref('fct_carts') }} c
    join {{ ref('dim_dates') }} dates on dates.date_key = c.date_key
    group by 1
),
sales as (
    select dates.date_day as activity_date,
           count(distinct f.order_id) as paid_orders,
           round(sum(f.net_amount), 2) as net_revenue,
           sum(f.units) as units
    from {{ ref('fct_order_items') }} f
    join {{ ref('dim_dates') }} dates on dates.date_key = f.date_key
    where f.is_settled
    group by 1
),
payments as (
    select dates.date_day as activity_date,
           count(*) as payment_attempts,
           sum(t.is_declined) as declines,
           round(sum(t.declined_amount), 2) as declined_amount
    from {{ ref('fct_transactions') }} t
    join {{ ref('dim_dates') }} dates on dates.date_key = t.date_key
    group by 1
)

select
    carts.activity_date,
    carts.carts_created,
    carts.carts_converted,
    carts.cart_value,
    carts.abandoned_value,
    coalesce(sales.paid_orders, 0)       as paid_orders,
    coalesce(sales.net_revenue, 0)       as net_revenue,
    coalesce(sales.units, 0)             as units,
    coalesce(payments.payment_attempts, 0) as payment_attempts,
    coalesce(payments.declines, 0)       as declines,
    coalesce(payments.declined_amount, 0) as declined_amount
from carts
left join sales    on sales.activity_date = carts.activity_date
left join payments on payments.activity_date = carts.activity_date
