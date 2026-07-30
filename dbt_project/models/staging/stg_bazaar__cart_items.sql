with source as (select * from {{ source('bazaar', 'cart_items') }}),

renamed as (
    select
        cart_id,
        product_id,
        quantity,
        cast(added_ts as timestamp) as added_at
    from source
)

select * from renamed
