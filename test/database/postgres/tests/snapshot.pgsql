BEGIN;
  -- SELECT plan(6);
  SELECT lazycloud_add_version('A', '{}');

  SELECT set_config('lazycloud.version_id', 'A', false);

  -- INSERT INTO lazycloud_lazycloud_test_table (lazycloud_version, name) VALUES ('C', 'billy');
  -- 
  -- DELETE FROM lazycloud_test_table WHERE id = lastval();
  -- 
  -- SELECT results_eq(
  --   'SELECT lazycloud_version, name, lazycloud_tombstone FROM lazycloud_lazycloud_test_table',
  --   $$VALUES ('C', 'billy', true)$$
  -- );
  -- 
  -- SELECT results_ne(
  --   'SELECT lazycloud_version, name, lazycloud_tombstone FROM lazycloud_test_table',
  --   $$VALUES ('C', 'billy', true)$$
  -- );
  -- 
  -- SELECT is_empty(
  --   'SELECT lazycloud_version, name, lazycloud_tombstone FROM lazycloud_test_table'
  -- );
  -- 
  -- DELETE FROM lazycloud_lazycloud_test_table WHERE name = 'billy';
  -- 
  -- INSERT INTO lazycloud_lazycloud_test_table (lazycloud_version, name) VALUES ('C', 'rodney');
  -- 
  -- DELETE FROM lazycloud_test_table WHERE name = 'rodney';
  -- 
  -- SELECT results_eq(
  --   'SELECT lazycloud_version, name, lazycloud_tombstone FROM lazycloud_lazycloud_test_table',
  --   $$VALUES ('C', 'rodney', true)$$
  -- );
  -- 
  -- SELECT results_ne(
  --   'SELECT lazycloud_version, name, lazycloud_tombstone FROM lazycloud_test_table',
  --   $$VALUES ('C', 'rodney', true)$$
  -- );
  -- 
  -- SELECT is_empty(
  --   'SELECT lazycloud_version, name, lazycloud_tombstone FROM lazycloud_test_table'
  -- );
  -- SELECT * FROM finish();
ROLLBACK;
