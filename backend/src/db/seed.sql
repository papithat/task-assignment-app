INSERT INTO skills (name) VALUES ('Frontend'), ('Backend')
  ON CONFLICT (name) DO NOTHING;

INSERT INTO developers (name) VALUES ('Alice'), ('Bob'), ('Carol'), ('Dave')
  ON CONFLICT (name) DO NOTHING;

INSERT INTO developer_skills (developer_id, skill_id)
SELECT d.id, s.id
FROM developers d, skills s
WHERE (d.name = 'Alice' AND s.name = 'Frontend')
   OR (d.name = 'Bob' AND s.name = 'Backend')
   OR (d.name = 'Carol' AND s.name IN ('Frontend', 'Backend'))
   OR (d.name = 'Dave' AND s.name = 'Backend')
ON CONFLICT DO NOTHING;
