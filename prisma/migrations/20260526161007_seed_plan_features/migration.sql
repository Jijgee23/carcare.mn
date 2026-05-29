-- Багц бүрийн анхдагч боломжуудыг бичнэ. Зөвхөн PlanFeature хүснэгт
-- хоосон үед л insert хийнэ — super admin засварласан өгөгдлийг
-- дарж бичихгүй.

INSERT INTO "PlanFeature" ("id", "plan", "label", "value", "sortOrder", "highlighted", "createdAt", "updatedAt")
SELECT * FROM (VALUES
  ('pf_free_users',     'FREE'::"Plan",       'Хамгийн их хэрэглэгч',  '10',          1, TRUE,  NOW(), NOW()),
  ('pf_free_orders',    'FREE'::"Plan",       'Өдрийн захиалга',       '100',         2, FALSE, NOW(), NOW()),
  ('pf_free_services',  'FREE'::"Plan",       'Үйлчилгээний тоо',      '50',          3, FALSE, NOW(), NOW()),

  ('pf_biz_users',      'BUSINESS'::"Plan",   'Хамгийн их хэрэглэгч',  '50',          1, TRUE,  NOW(), NOW()),
  ('pf_biz_orders',     'BUSINESS'::"Plan",   'Өдрийн захиалга',       '250',         2, FALSE, NOW(), NOW()),
  ('pf_biz_services',   'BUSINESS'::"Plan",   'Үйлчилгээний тоо',      '150',         3, FALSE, NOW(), NOW()),

  ('pf_ent_users',      'ENTERPRISE'::"Plan", 'Хамгийн их хэрэглэгч',  'Хязгааргүй',  1, TRUE,  NOW(), NOW()),
  ('pf_ent_orders',     'ENTERPRISE'::"Plan", 'Өдрийн захиалга',       'Хязгааргүй',  2, TRUE,  NOW(), NOW()),
  ('pf_ent_services',   'ENTERPRISE'::"Plan", 'Үйлчилгээний тоо',      'Хязгааргүй',  3, TRUE,  NOW(), NOW())
) AS v(id, plan, label, value, "sortOrder", highlighted, "createdAt", "updatedAt")
WHERE NOT EXISTS (SELECT 1 FROM "PlanFeature");
