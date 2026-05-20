-- Fix sync outbox trigger operation casing.
-- TG_OP returns uppercase INSERT/UPDATE/DELETE, while sync_outbox.operation
-- intentionally stores lowercase values expected by the sync worker.

CREATE OR REPLACE FUNCTION sync_outbox_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip if this change came from Airtable to prevent sync loops.
  IF (TG_OP = 'DELETE') THEN
    IF OLD.sync_origin = 'airtable' THEN RETURN OLD; END IF;
    INSERT INTO sync_outbox (table_name, record_id, airtable_record_id, operation, payload)
    VALUES (TG_TABLE_NAME, OLD.id, OLD.airtable_record_id, 'delete', row_to_json(OLD)::jsonb);
    RETURN OLD;
  END IF;

  IF NEW.sync_origin = 'airtable' THEN
    RETURN NEW;
  END IF;

  INSERT INTO sync_outbox (table_name, record_id, airtable_record_id, operation, payload)
  VALUES (TG_TABLE_NAME, NEW.id, NEW.airtable_record_id, LOWER(TG_OP::TEXT), row_to_json(NEW)::jsonb)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
