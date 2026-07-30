with source as (select * from {{ source('bazaar', 'transactions') }}),

renamed as (
    select
        txn_id,
        order_id,
        cast(txn_ts as timestamp) as attempted_at,
        amount,                            -- signed: negative for refunds
        currency,
        payment_method,
        status                    as txn_status,
        coalesce(decline_reason, 'none') as decline_reason,
        psp_ref,

        -- Pre-split measures so every rate downstream has an additive numerator and an
        -- additive denominator, and nobody has to store a ratio.
        case when status = 'approved' then 1 else 0 end as is_approved,
        case when status = 'declined' then 1 else 0 end as is_declined,
        case when status = 'refunded' then 1 else 0 end as is_refund,
        case when status = 'approved' then amount else 0 end as approved_amount,
        case when status = 'declined' then amount else 0 end as declined_amount
    from source
)

select * from renamed
