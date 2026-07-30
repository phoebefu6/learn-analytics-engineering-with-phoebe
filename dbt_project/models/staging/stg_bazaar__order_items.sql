with source as (select * from {{ source('bazaar', 'order_items') }}),

renamed as (
    select
        order_id,
        line_no,
        product_id,
        merchant_id,        -- captured at time of sale, not looked up: see the b3 note
        quantity,
        unit_price,
        discount_amt,
        round(quantity * unit_price, 2)                 as gross_amount,
        round(quantity * unit_price - discount_amt, 2)  as net_amount
    from source
)

select * from renamed
