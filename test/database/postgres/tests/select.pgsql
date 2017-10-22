BEGIN;
  SELECT plan(4);
  SELECT lazycloud_add_version('A', '{}');
  SELECT lazycloud_add_version('B', '{"A"}');
  SELECT lazycloud_add_version('C', '{"B"}');
  SELECT lazycloud_add_version('D', '{"A"}');

  INSERT INTO lazycloud_lazycloud_test_table (id, name, lazycloud_version)
    VALUES (1, 'billy', 'A'), (2, 'robby', 'B'), (2, 'rob', 'C'),
      (3, 'buddy', 'C'), (1, 'danny', 'D');

  SELECT set_config('lazycloud.version_id', 'C', false);
  SELECT results_eq(
    'SELECT * FROM lazycloud_test_table',
    $$VALUES
      (1, 'billy', 'A', false),
      (2, 'rob', 'C', false),
      (3, 'buddy', 'C', false)
    $$
  );

  SELECT set_config('lazycloud.version_id', 'A', false);
  SELECT results_eq(
    'SELECT * FROM lazycloud_test_table',
    $$VALUES (1, 'billy', 'A', false)$$
  );

  SELECT set_config('lazycloud.version_id', 'B', false);
  SELECT results_eq(
    'SELECT * FROM lazycloud_test_table',
    $$VALUES (1, 'billy', 'A', false), (2, 'robby', 'B', false)$$
  );

  SELECT set_config('lazycloud.version_id', 'D', false);
  SELECT results_eq(
    'SELECT * FROM lazycloud_test_table',
    $$VALUES (1, 'danny', 'D', false)$$
  );

  SELECT * FROM finish();
ROLLBACK;
