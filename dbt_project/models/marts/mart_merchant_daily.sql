-- GRAIN: one merchant per day. Serves "which merchant dropped", revenue by tier, and the
-- merchant scorecard. Ratios ship as numerator and denominator, never as the ratio.
with facts as (select * from {{ ref('fct_order_items') }}),
     dims as (select * from {{ ref('dim_merchants') }}),
     dates as (select * from {{ ref('dim_dates') }})

select
    dates.date_day                    as activity_date,
    dims.merchant_id,
    dims.merchant_name,
    dims.merchant_category,
    dims.merchant_tier,
    count(distinct facts.order_id)    as orders,
    sum(facts.units)                  as units,
    round(sum(facts.gross_amount), 2) as gross_revenue,
    round(sum(facts.discount_amount), 2) as discounts,
    round(sum(facts.net_amount), 2)   as net_revenue,
    round(sum(facts.commission_amount), 2) as commission,
    round(sum(facts.margin_amount), 2) as margin,
    round(sum(facts.net_amount), 2)   as aov_numerator,
    count(distinct facts.order_id)    as aov_denominator
from facts
join dates on dates.date_key = facts.date_key
join dims  on dims.merchant_sk = facts.merchant_sk
where facts.is_settled
group by 1, 2, 3, 4, 5
