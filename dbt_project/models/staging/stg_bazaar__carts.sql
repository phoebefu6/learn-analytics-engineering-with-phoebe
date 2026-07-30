with source as (select * from {{ source('bazaar', 'carts') }}),

renamed as (
    select
        cart_id,
        user_id,
        cast(created_ts as timestamp) as created_at,
        status                       as cart_status
    from source
)

select * from renamed
