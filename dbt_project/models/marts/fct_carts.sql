-- GRAIN: one row per cart. Demand that never became revenue - without this fact, "sales
-- fell" and "people stopped wanting to buy" look identical.
with carts as (select * from {{ ref('stg_bazaar__carts') }}),
     contents as (select * from {{ ref('int_cart_contents') }}),
     orders as (select * from {{ ref('stg_bazaar__orders') }}),
     dim_users as (select * from {{ ref('dim_users') }}),
     dim_merchants as (select * from {{ ref('dim_merchants') }}),
     dim_dates as (select * from {{ ref('dim_dates') }})

select
    {{ surrogate_key(['carts.cart_id']) }}   as cart_sk,

    coalesce(dim_dates.date_key, '-1')       as date_key,
    hour(carts.created_at)                   as time_key,
    coalesce(dim_users.user_sk, '-1')        as user_sk,
    coalesce(dim_merchants.merchant_sk, '-1') as merchant_sk,

    carts.cart_id,                            -- degenerate
    orders.order_id,                          -- null when abandoned

    contents.distinct_products,
    contents.units,
    contents.cart_value,
    orders.order_id is not null              as is_converted,
    case when orders.order_id is null then contents.cart_value else 0 end as abandoned_value,
    case
        when orders.order_id is null then null
        else round(date_diff('second', carts.created_at, orders.ordered_at) / 60.0, 1)
    end                                      as minutes_to_order
from carts
join contents on contents.cart_id = carts.cart_id
left join orders        on orders.cart_id = carts.cart_id
left join dim_dates     on dim_dates.date_day = cast(carts.created_at as date)
left join dim_users     on dim_users.user_id = carts.user_id
left join dim_merchants on dim_merchants.merchant_id = contents.dominant_merchant_id and dim_merchants.is_current
