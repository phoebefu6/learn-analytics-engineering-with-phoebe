{# A custom generic test. Any test you write more than twice belongs here: give it a name,
   and it becomes a one-line assertion in every schema.yml that needs it. #}
{% test dbt_positive_value(model, column_name) %}
select {{ column_name }}
from {{ model }}
where {{ column_name }} is null or {{ column_name }} <= 0
{% endtest %}
