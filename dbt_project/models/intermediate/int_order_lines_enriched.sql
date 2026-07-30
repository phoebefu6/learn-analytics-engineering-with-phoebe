-- Intermediate models are the joins staging is not allowed to do. They are ephemeral: dbt
-- inlines them into the models that ref() them, so nothing is materialized and nobody can
-- query a half-finished shape by accident.
with lines as (select * from {{ ref('stg_bazaar__order_items') }}),
     orders as (select * from {{ ref('stg_bazaar__orders') }}),
     products as (select * from {{ ref('stg_bazaar__products') }}),
     merchants as (select * from {{ ref('stg_bazaar__merchants') }})

select
    lines.order_id,
    lines.line_no,
    orders.user_id,
    lines.product_id,
    lines.merchant_id,
    orders.ordered_at,
    orders.is_settled,
    lines.quantity,
    lines.unit_price,
    lines.gross_amount,
    lines.discount_amt,
    lines.net_amount,
    round(lines.net_amount * merchants.commission_pct, 2)      as commission_amount,
    round(lines.quantity * products.unit_cost, 2)              as cost_amount,
    round(lines.net_amount - lines.quantity * products.unit_cost, 2) as margin_amount
from lines
join orders    on orders.order_id = lines.order_id
join products  on products.product_id = lines.product_id
join merchants on merchants.merchant_id = lines.merchant_id
