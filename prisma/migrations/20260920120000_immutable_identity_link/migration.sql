-- A linked identity cannot be silently replaced or cleared by future code.
CREATE FUNCTION prevent_identity_relink() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."identityProviderId" IS NOT NULL AND NEW."identityProviderId" IS DISTINCT FROM OLD."identityProviderId" THEN
    RAISE EXCEPTION 'Linked identity is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "User_identity_immutable" BEFORE UPDATE ON "User"
  FOR EACH ROW EXECUTE FUNCTION prevent_identity_relink();
