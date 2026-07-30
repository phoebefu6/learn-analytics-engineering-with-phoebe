-- GRAIN: one row per product line on one order. The revenue fact.
-- Dimension keys resolved with LEFT JOIN and coalesced to the unknown member: an inner join
-- here would silently drop a fact row, and silently-missing revenue is the worst failure
-- mode in the whole project.
with lines as (select * from {{ ref('int_order_lines_enriched') }}),
     dim_users as (select * from {{ ref('dim_users') }}),
     dim_merchants as (select * from {{ ref('dim_merchants') }}),
     dim_products as (select * from {{ ref('dim_products') }}),
     dim_dates as (select * from {{ ref('dim_dates') }})

select
    {{ surrogate_key(['lines.order_id', 'lines.line_no']) }} as order_item_sk,

    coalesce(dim_dates.date_key, '-1')      as date_key,
    hour(lines.ordered_at)                  as time_key,
    coalesce(dim_users.user_sk, '-1')       as user_sk,
    coalesce(dim_merchants.merchant_sk, '-1') as merchant_sk,
    coalesce(dim_products.product_sk, '-1') as product_sk,

    lines.order_id,                          -- degenerate dimension
    lines.line_no,                           -- degenerate dimension

    lines.quantity                          as units,
    lines.unit_price,                        -- a rate, not additive: kept for reference
    lines.gross_amount,
    lines.discount_amt                      as discount_amount,
    lines.net_amount,
    lines.commission_amount,
    lines.cost_amount,
    lines.margin_amount,
    lines.is_settled
from lines
left join dim_dates     on dim_dates.date_day = cast(lines.ordered_at as date)
left join dim_users     on dim_users.user_id = lines.user_id
left join dim_merchants on dim_merchants.merchant_id = lines.merchant_id and dim_merchants.is_current
left join dim_products  on dim_products.product_id = lines.product_id
