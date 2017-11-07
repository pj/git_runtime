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
