-- One model per source table. Staging does four things and nothing else:
-- rename, recast, light cleaning, and no joins. That discipline is why staging
-- models are cheap to read and safe to change.
with source as (select * from {{ source('bazaar', 'users') }}),

renamed as (
    select
        user_id,
        email,
        cast(signup_ts as timestamp)            as signed_up_at,
        country                                 as user_country,
        coalesce(city, 'unknown')               as user_city,
        coalesce(acquisition_channel, 'unknown') as acquisition_channel,
        cast(is_guest as boolean)               as is_guest
    from source
)

select * from renamed
