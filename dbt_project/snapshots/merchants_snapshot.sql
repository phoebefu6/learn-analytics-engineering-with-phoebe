{#
  A type-2 snapshot: dbt's first-class answer to "this attribute changes and the history
  matters". Every run, dbt compares the incoming rows to what it stored and closes the old
  version rather than overwriting it - so a sale in April keeps reporting April's tier and
  commission even after the merchant is promoted in June.

  check_cols names the columns whose change opens a new version. Anything not listed here
  is treated as type 1 and simply overwritten.
#}
{% snapshot merchants_snapshot %}

{{
    config(
      target_schema='snapshots',
      unique_key='merchant_id',
      strategy='check',
      check_cols=['merchant_tier', 'commission_pct', 'merchant_name']
    )
}}

select
    merchant_id,
    merchant_name,
    merchant_category,
    merchant_country,
    merchant_tier,
    commission_pct,
    joined_on
from {{ ref('stg_bazaar__merchants') }}

{% endsnapshot %}
