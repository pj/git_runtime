SELECT delete_table_or_view('lazycloud_test_table');
SELECT delete_table_or_view('lazycloud_lazycloud_test_table');
CREATE TABLE lazycloud_test_table (
  id SERIAL,
  name text
);

SELECT delete_table_or_view('lazycloud_version_tree');
SELECT lazycloud_create_version_tree_table();
