UPDATE "CharacterState"
SET "goalState" = COALESCE((
  SELECT jsonb_agg(jsonb_build_object(
    'id', 'goal-' || item.ordinality,
    'title', item.title,
    'status', 'active',
    'progress', 0,
    'motivation', 65,
    'updatedAt', 'legacy-import'
  ) ORDER BY item.ordinality)
  FROM unnest("CharacterState"."goals") WITH ORDINALITY AS item(title, ordinality)
), '[]'::jsonb)
WHERE "goalState" = '[]'::jsonb;

UPDATE "CharacterState"
SET "dailyState" = jsonb_build_object(
  'energy', GREATEST(0, LEAST(100, ROUND(
    72 - COALESCE(NULLIF("emotion"->>'stress', '')::numeric, 50) * 0.3
       + COALESCE(NULLIF("emotion"->>'satisfaction', '')::numeric, 50) * 0.12
  ))),
  'workload', GREATEST(0, LEAST(100, ROUND(
    28 + COALESCE(NULLIF("emotion"->>'stress', '')::numeric, 50) * 0.45
  ))),
  'socialBattery', GREATEST(0, LEAST(100, ROUND(
    62 - COALESCE(NULLIF("emotion"->>'stress', '')::numeric, 50) * 0.18
  ))),
  'budgetPressure', 35
)
WHERE "dailyState" = '{}'::jsonb;
