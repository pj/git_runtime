SELECT delete_table_or_view('lazycloud_test_table');
SELECT delete_table_or_view('lazycloud_lazycloud_test_table');
SELECT delete_table_or_view('lazycloud_version_tree');
SELECT delete_table_or_view('lazycloud_snapshot');
SELECT lazycloud_create_internal_tables();
CREATE TABLE lazycloud_test_table (
  test_id SERIAL PRIMARY KEY,
  username text
);
