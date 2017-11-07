BEGIN;
  SELECT plan(5);
  SELECT lazycloud_add_version('A', '{}');
  SELECT lazycloud_add_version('B', '{"A"}');
  SELECT lazycloud_add_version('C', '{"B"}');
  SELECT lazycloud_add_version('D', '{"B"}');

  SELECT set_config('lazycloud.version_id', 'C', false);

  -- update existing
  INSERT INTO lazycloud_lazycloud_test_table
    (lazycloud_version, name, lazycloud_snapshot)
    VALUES ('C', 'billy', 0);
  --
  UPDATE lazycloud_test_table SET name = 'bobby' WHERE id=lastval();
  SELECT results_eq(
    'SELECT lazycloud_version, name FROM lazycloud_lazycloud_test_table',
    $$VALUES ('C', 'bobby')$$
  );
  DELETE FROM lazycloud_lazycloud_test_table;

  -- update previous version
  INSERT INTO lazycloud_lazycloud_test_table
    (lazycloud_version, name, lazycloud_snapshot)
    VALUES ('B', 'billy', 0);
  SELECT set_config('lazycloud.version_id', 'C', false);
  UPDATE lazycloud_test_table SET name = 'bobby' WHERE id=lastval();
  SELECT set_config('lazycloud.version_id', 'D', false);
  UPDATE lazycloud_test_table SET name = 'blobby' WHERE id=lastval();
  SELECT results_eq(
    'SELECT lazycloud_version, name FROM lazycloud_lazycloud_test_table
      ORDER BY lazycloud_version',
    $$VALUES ('B', 'billy'), ('C', 'bobby'), ('D', 'blobby')$$
  );
  DELETE FROM lazycloud_lazycloud_test_table;

  -- update multiple existing version
  INSERT INTO lazycloud_lazycloud_test_table
    (lazycloud_version, name, lazycloud_snapshot)
    VALUES ('C', 'billy', 0);
  INSERT INTO lazycloud_lazycloud_test_table
    (lazycloud_version, name, lazycloud_snapshot)
    VALUES ('C', 'bobby', 0);
  SELECT set_config('lazycloud.version_id', 'C', false);
  UPDATE lazycloud_test_table SET name = 'robby';
  SELECT results_eq(
    'SELECT lazycloud_version, name FROM lazycloud_lazycloud_test_table',
    $$VALUES ('C', 'robby'), ('C', 'robby')$$
  );
  DELETE FROM lazycloud_lazycloud_test_table;

  -- update multiple older version
  INSERT INTO lazycloud_lazycloud_test_table
    (lazycloud_version, name, lazycloud_snapshot)
    VALUES ('A', 'billy', 0);
  INSERT INTO lazycloud_lazycloud_test_table
    (lazycloud_version, name, lazycloud_snapshot)
    VALUES ('B', 'bobby', 0);
  SELECT set_config('lazycloud.version_id', 'C', false);
  UPDATE lazycloud_test_table SET name = 'robby';
  SELECT results_eq(
    'SELECT lazycloud_version, name FROM lazycloud_lazycloud_test_table',
    $$VALUES ('A', 'billy'), ('B', 'bobby'), ('C', 'robby'), ('C', 'robby')$$
  );
  DELETE FROM lazycloud_lazycloud_test_table;

  -- update multiple some not others.
  INSERT INTO lazycloud_lazycloud_test_table
    (lazycloud_version, name, lazycloud_snapshot)
    VALUES ('A', 'billy', 0);
  INSERT INTO lazycloud_lazycloud_test_table
    (lazycloud_version, name, lazycloud_snapshot)
    VALUES ('C', 'bobby', 0);
  INSERT INTO lazycloud_lazycloud_test_table
    (lazycloud_version, name, lazycloud_snapshot)
    VALUES ('D', 'blobby', 0);
  SELECT set_config('lazycloud.version_id', 'C', false);
  UPDATE lazycloud_test_table SET name = 'robby';
  SELECT results_eq(
    'SELECT lazycloud_version, name FROM lazycloud_lazycloud_test_table
      ORDER BY lazycloud_version',
    $$VALUES ('A', 'billy'), ('C', 'robby'), ('C', 'robby'), ('D', 'blobby')$$
    -- $$VALUES ('C', 'robby'), ('C', 'robby'), ('C', 'robby'), ('C', 'robby')$$
  );
  DELETE FROM lazycloud_lazycloud_test_table;

  SELECT * FROM finish();
ROLLBACK;
