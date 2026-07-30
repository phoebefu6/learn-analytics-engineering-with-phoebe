-- Rolls cart_items up to one row per cart, and picks the cart's dominant merchant (the one
-- on its highest-value line). That choice is a modeling decision with a cost, documented in
-- the marts schema.yml rather than left for someone to discover.
with items as (select * from {{ ref('stg_bazaar__cart_items') }}),
     products as (select * from {{ ref('stg_bazaar__products') }}),

joined as (
    select
        items.cart_id,
        items.product_id,
        items.quantity,
        products.merchant_id,
        products.list_price,
        items.quantity * products.list_price as line_value
    from items
    join products on products.product_id = items.product_id
),

ranked as (
    select *,
           row_number() over (partition by cart_id order by line_value desc, merchant_id) as value_rank
    from joined
)

select
    cart_id,
    count(*)                       as distinct_products,
    sum(quantity)                  as units,
    round(sum(line_value), 2)      as cart_value,
    max(case when value_rank = 1 then merchant_id end) as dominant_merchant_id
from ranked
group by cart_id
