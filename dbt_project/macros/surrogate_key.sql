{# A deterministic surrogate key. dbt models are rebuilt from scratch, so a database
   sequence would hand out different numbers every run and yesterday's facts would point at
   the wrong dimension rows. Hashing the business key gives the same key every time, on any
   machine, with no state to keep. (dbt_utils ships this as generate_surrogate_key; it is
   written out here so you can see there is no magic in it.) #}
{% macro surrogate_key(fields) %}
    md5(concat_ws('|',
        {%- for field in fields %}
        coalesce(cast({{ field }} as varchar), '_null_'){{ "," if not loop.last }}
        {%- endfor %}
    ))
{% endmacro %}
