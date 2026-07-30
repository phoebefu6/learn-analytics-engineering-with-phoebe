-- A small dimension that exists because grouping by a raw source string ('card_visa') is
-- not the grouping anyone wants. Built from the distinct values with the business grouping
-- attached, so a new method in the source shows up as 'unknown' rather than vanishing.
with methods as (
    select distinct payment_method from {{ ref('stg_bazaar__transactions') }}
)

select
    {{ surrogate_key(['payment_method']) }} as payment_method_sk,
    payment_method,
    case payment_method
        when 'card_visa'       then 'Visa'
        when 'card_mastercard' then 'Mastercard'
        when 'card_amex'       then 'Amex'
        when 'paynow'          then 'PayNow'
        when 'grabpay'         then 'GrabPay'
        when 'bank_transfer'   then 'Bank transfer'
        else 'unknown'
    end as method_label,
    case
        when payment_method like 'card_%' then 'card'
        when payment_method in ('paynow', 'bank_transfer') then 'bank'
        when payment_method = 'grabpay' then 'wallet'
        else 'unknown'
    end as method_family,
    payment_method like 'card_%' as is_card
from methods
