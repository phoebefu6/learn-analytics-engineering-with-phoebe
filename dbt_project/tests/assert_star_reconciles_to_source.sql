-- The single most important test in the project: does the warehouse still agree with the
-- system of record? Fails if settled net revenue in the fact drifts from the source by more
-- than a cent. A singular test is just a query that must return zero rows.
with fact as (
    select round(sum(net_amount), 2) as amount from {{ ref('fct_order_items') }}
),
source as (
    select round(sum(quantity * unit_price - discount_amt), 2) as amount
    from {{ source('bazaar', 'order_items') }}
)
select fact.amount as fact_amount, source.amount as source_amount
from fact cross join source
where abs(fact.amount - source.amount) > 0.01
