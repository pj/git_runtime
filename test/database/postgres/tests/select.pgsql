BEGIN;
  SELECT plan(4);
  SELECT lazycloud_add_version('A', '{}');
  SELECT lazycloud_add_version('B', '{"A"}');
  SELECT lazycloud_add_version('C', '{"B"}');
  SELECT lazycloud_add_version('D', '{"A"}');

  INSERT INTO lazycloud_lazycloud_test_table
    (test_id, username, lazycloud_version, lazycloud_snapshot)
    VALUES
      (1, 'billy', 'A', 0),
      (2, 'robby', 'B', 0),
      (2, 'rob', 'C', 0),
      (3, 'buddy', 'C', 0),
      (1, 'danny', 'D', 0);

  SELECT set_config('lazycloud.version_id', 'C', false);
  SELECT results_eq(
    'SELECT * FROM lazycloud_test_table',
    $$VALUES
      (1, 'billy', 'A', false, 0::bigint),
      (2, 'rob', 'C', false, 0::bigint),
      (3, 'buddy', 'C', false, 0::bigint)
    $$
  );

  SELECT set_config('lazycloud.version_id', 'A', false);
  SELECT results_eq(
    'SELECT * FROM lazycloud_test_table',
    $$VALUES (1, 'billy', 'A', false, 0::bigint)$$
  );

  SELECT set_config('lazycloud.version_id', 'B', false);
  SELECT results_eq(
    'SELECT * FROM lazycloud_test_table',
    $$VALUES
      (1, 'billy', 'A', false, 0::bigint),
      (2, 'robby', 'B', false, 0::bigint)
    $$
  );

  SELECT set_config('lazycloud.version_id', 'D', false);
  SELECT results_eq(
    'SELECT * FROM lazycloud_test_table',
    $$VALUES (1, 'danny', 'D', false, 0::bigint)$$
  );

  SELECT * FROM finish();
ROLLBACK;
