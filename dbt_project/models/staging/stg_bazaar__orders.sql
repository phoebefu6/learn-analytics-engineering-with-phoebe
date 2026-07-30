with source as (select * from {{ source('bazaar', 'orders') }}),

renamed as (
    select
        order_id,
        user_id,
        cart_id,
        cast(order_ts as timestamp) as ordered_at,
        status                      as order_status,
        ship_country,
        currency,

        -- One boolean, defined once, instead of every downstream query inventing its own
        -- idea of which statuses count as money. Session b4's favourite line.
        order_status in ('paid', 'refunded') as is_settled
    from source
)

select * from renamed
