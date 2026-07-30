with source as (select * from {{ source('bazaar', 'products') }}),

renamed as (
    select
        product_id,
        merchant_id,
        sku,
        product_name,
        category    as product_category,
        list_price,
        unit_cost,
        cast(launched_date as date) as launched_on,
        status      as product_status,

        -- price_tier is MODELED here, not sourced: the business thinks in bands and the
        -- source only has a number. Defining it once is what stops three dashboards
        -- disagreeing about what "premium" means.
        case
            when list_price < 25 then 'budget'
            when list_price < 80 then 'mid'
            else 'premium'
        end as price_tier
    from source
)

select * from renamed
