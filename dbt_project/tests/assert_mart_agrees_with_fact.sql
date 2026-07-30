-- A mart that disagrees with the fact it aggregates is a second source of truth, which is
-- worse than no mart at all because it looks authoritative.
with mart as (select round(sum(net_revenue), 2) as amount from {{ ref('mart_merchant_daily') }}),
     fact as (select round(sum(net_amount), 2) as amount from {{ ref('fct_order_items') }} where is_settled)
select mart.amount as mart_amount, fact.amount as fact_amount
from mart cross join fact
where abs(mart.amount - fact.amount) > 0.01
