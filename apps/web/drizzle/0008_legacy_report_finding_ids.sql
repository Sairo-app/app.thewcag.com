DO $$
DECLARE
	report_row record;
	issue jsonb;
	repaired_issues jsonb;
	raw_id text;
	issue_id text;
	date_stamp text;
	parsed_date date;
	valid_id boolean;
	entropy bytea;
	entropy_index integer;
	fingerprint text;
	alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
BEGIN
	-- Register valid IDs already stored in reports before allocating replacements,
	-- so a generated legacy ID can never collide with an unregistered stored ID.
	FOR report_row IN
		SELECT "id", "created_at", "issues"
		FROM "report"
		WHERE jsonb_typeof("issues") = 'array'
	LOOP
		FOR issue IN SELECT value FROM jsonb_array_elements(report_row."issues")
		LOOP
			IF jsonb_typeof(issue) <> 'object' THEN
				CONTINUE;
			END IF;

			raw_id := upper(btrim(issue ->> 'id'));
			valid_id := raw_id IS NOT NULL AND raw_id ~
				'^WCG-F-[0-9]{8}-[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{6}$';
			IF valid_id THEN
				BEGIN
					date_stamp := substring(raw_id FROM 7 FOR 8);
					parsed_date := to_date(date_stamp, 'YYYYMMDD');
					valid_id := to_char(parsed_date, 'YYYYMMDD') = date_stamp;
				EXCEPTION WHEN others THEN
					valid_id := false;
				END;
			END IF;

			IF valid_id THEN
				INSERT INTO "finding_identity" ("id", "first_seen_at")
				VALUES (raw_id, report_row."created_at")
				ON CONFLICT ("id") DO NOTHING;
			END IF;
		END LOOP;
	END LOOP;

	-- Persist an ID on every legacy object and register it in the same transaction.
	FOR report_row IN
		SELECT "id", "created_at", "issues"
		FROM "report"
		WHERE jsonb_typeof("issues") = 'array'
		FOR UPDATE
	LOOP
		repaired_issues := '[]'::jsonb;
		FOR issue IN SELECT value FROM jsonb_array_elements(report_row."issues")
		LOOP
			IF jsonb_typeof(issue) = 'object' THEN
				raw_id := upper(btrim(issue ->> 'id'));
				valid_id := raw_id IS NOT NULL AND raw_id ~
					'^WCG-F-[0-9]{8}-[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{6}$';
				IF valid_id THEN
					BEGIN
						date_stamp := substring(raw_id FROM 7 FOR 8);
						parsed_date := to_date(date_stamp, 'YYYYMMDD');
						valid_id := to_char(parsed_date, 'YYYYMMDD') = date_stamp;
					EXCEPTION WHEN others THEN
						valid_id := false;
					END;
				END IF;

				IF valid_id THEN
					issue_id := raw_id;
				ELSE
					date_stamp := to_char(report_row."created_at", 'YYYYMMDD');
					LOOP
						entropy := uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid());
						fingerprint := '';
						FOR entropy_index IN 0..25 LOOP
							fingerprint := fingerprint || substr(
								alphabet,
								(get_byte(entropy, entropy_index) & 31) + 1,
								1
							);
						END LOOP;
						issue_id := 'WCG-F-' || date_stamp || '-' ||
							substr(fingerprint, 1, 5) || '-' ||
							substr(fingerprint, 6, 5) || '-' ||
							substr(fingerprint, 11, 5) || '-' ||
							substr(fingerprint, 16, 5) || '-' ||
							substr(fingerprint, 21, 6);
						EXIT WHEN NOT EXISTS (
							SELECT 1 FROM "finding_identity" WHERE "id" = issue_id
						);
					END LOOP;
				END IF;

				issue := jsonb_set(issue, '{id}', to_jsonb(issue_id), true);
				INSERT INTO "finding_identity" ("id", "first_seen_at")
				VALUES (issue_id, report_row."created_at")
				ON CONFLICT ("id") DO NOTHING;
			END IF;

			repaired_issues := repaired_issues || jsonb_build_array(issue);
		END LOOP;

		IF repaired_issues IS DISTINCT FROM report_row."issues" THEN
			UPDATE "report" SET "issues" = repaired_issues WHERE "id" = report_row."id";
		END IF;
	END LOOP;
END $$;
