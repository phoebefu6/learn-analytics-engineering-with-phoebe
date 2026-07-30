-- Flat and wide, not snowflaked: the merchant's name rides along even though dim_merchants
-- has it. One less join in every analyst query and every query an AI agent writes.
with products as (select * from {{ ref('stg_bazaar__products') }}),
     merchants as (select * from {{ ref('stg_bazaar__merchants') }})

select
    {{ surrogate_key(['products.product_id']) }} as product_sk,
    products.product_id,
    products.sku,
    products.product_name,
    products.product_category,
    products.merchant_id,
    merchants.merchant_name,
    products.list_price,
    products.unit_cost,
    products.price_tier,
    products.product_status,
    products.launched_on
from products
join merchants on merchants.merchant_id = products.merchant_id
