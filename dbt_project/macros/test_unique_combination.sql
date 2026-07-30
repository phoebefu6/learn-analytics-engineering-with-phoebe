{# Grain enforcement as a test: "one row is one (order_id, line_no)". If this ever fails,
   every SUM downstream is wrong, which is why it guards the line-grain models. #}
{% test unique_combination(model, columns) %}
select {{ columns | join(', ') }}, count(*) as n
from {{ model }}
group by {{ columns | join(', ') }}
having count(*) > 1
{% endtest %}
