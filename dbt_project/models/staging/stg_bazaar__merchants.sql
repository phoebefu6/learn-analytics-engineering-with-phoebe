with source as (select * from {{ source('bazaar', 'merchants') }}),

renamed as (
    select
        merchant_id,
        merchant_name,
        category        as merchant_category,
        country         as merchant_country,
        tier            as merchant_tier,
        commission_pct,
        cast(joined_date as date) as joined_on
    from source
)

select * from renamed
