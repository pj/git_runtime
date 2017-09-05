 CREATE OR REPLACE FUNCTION delete_table_or_view(objectName varchar)
   RETURNS integer
   LANGUAGE plpgsql AS $$
     DECLARE
       isTable integer;
       isView integer;
     BEGIN
       SELECT INTO isTable count(*) FROM pg_tables where tablename=objectName;
       SELECT INTO isView count(*) FROM pg_views where viewname=objectName;
       IF isTable = 1 THEN
         EXECUTE 'DROP TABLE ' || objectName || ' CASCADE';
         RETURN 1;
       END IF;
       IF isView = 1 THEN
         EXECUTE 'DROP VIEW ' || objectName || ' CASCADE';
         RETURN 2;
       END IF;
       RETURN 0;
     END;
  $$;

CREATE OR REPLACE FUNCTION is_temp_table(tableName varchar)
  RETURNS pg_catalog.bool
  LANGUAGE plpgsql AS $$
    BEGIN
       /* check the table exist in database and is visible*/
      PERFORM n.nspname, c.relname
        FROM pg_catalog.pg_class c
          LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname LIKE 'pg_temp_%'
          AND pg_catalog.pg_table_is_visible(c.oid)
          AND Upper(relname) = Upper(tableName);

      IF FOUND THEN
        RETURN TRUE;
      ELSE
        RETURN FALSE;
      END IF;
    END;
  $$;
