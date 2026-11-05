"""Review current R2 candidates and missing objects using a saved audit."""
import collections
import contextlib
import os
import json
import hashlib
import re

from cw_data_audit import Audit, Incomplete, MAX_BYTES, VALUES, category, r2_inventory
from pathlib import Path

TECHNICAL = {
    "roundRobinDrawsPendingCertification",
    "roundRobinGroupCertificationRequired",
}
IDENTIFIERS = {"membershipCard", "competitionId", "tournamentId", "playerId"}


SAFE_FIELDS = IDENTIFIERS | {
    "id", "code", "membershipCard", "subscriptionDate", "date", "timestamp",
    "url", "sourceUrl", "draw", "ranking", "full1", "full2", "phone",
    "telephone", "telefono", "cellulare", "mobileNumber", "email", "emailAddress",
    "mailAddress", "address", "name", "description", "notes", "unstructured",
}


def mobile_context(field, value):
    if field in SAFE_FIELDS:
        return field
    normalized = re.sub(r"[^a-z0-9]", "", (field or "").lower())
    if normalized in {"tessera", "numerotessera", "numerotessera1", "numerotessera2",
                      "cardnumber", "membershipnumber", "membershipcard1", "membershipcard2"}:
        return "membership_card"
    if normalized.endswith(("id", "identifier")) and normalized:
        return "field_ending_in_id"
    if value.startswith(("https://", "http://")):
        return "url_value"
    if re.fullmatch(r"[0-9 .+()-]+", value.strip()):
        shape = "numeric"
    else:
        shape = "embedded"
    # Keys can contain personal data too. Keep only a repeatable grouping.
    key_digest = hashlib.sha256((field or "").encode("utf-8", errors="replace")).hexdigest()
    return "unresolved_" + shape + "_" + key_digest


class Review(Audit):
    def json_value(self, value, counts, depth=0, field=None):
        if depth > 80:
            self.gap("json_depth")
            return
        if isinstance(value, dict):
            for key, child in value.items():
                if category(key) == "email" and child not in (None, "", [], {}):
                    if isinstance(child, str):
                        kind = "address_pattern" if VALUES["email_candidate"].search(child) else "other_string"
                    else:
                        kind = type(child).__name__
                    counts["email_field_" + kind] += 1
                self.json_value(child, counts, depth + 1, key)
        elif isinstance(value, list):
            for child in value:
                self.json_value(child, counts, depth + 1, field)
        elif isinstance(value, bytes):
            self.bytes(value, "blob", counts, depth + 1)
        elif isinstance(value, str) or type(value) is int:
            value = str(value)
            if value.lstrip().startswith(("{", "[")):
                try:
                    nested = json.loads(value)
                except (ValueError, RecursionError):
                    pass
                else:
                    self.json_value(nested, counts, depth + 1, field)
                    return
            hits = len(VALUES["italian_mobile_candidate"].findall(value))
            if hits:
                label = mobile_context(field, value)
                if category(field) == "phone":
                    label = "phone_field"
                counts["mobile_in_" + label] += hits
            emails = len(VALUES["email_candidate"].findall(value))
            if emails:
                counts["email_address_pattern"] += emails

    def text(self, text, counts):
        try:
            parsed = json.loads(text)
        except (ValueError, RecursionError):
            self.json_value(text, counts, field="unstructured")
        else:
            self.json_value(parsed, counts)


def main():
    import boto3
    from botocore.config import Config

    os.umask(0o077)
    audit = Review("r2", "audit-contact-context", 55 * 60)
    try:
        targets = json.loads(Path(__file__).with_name("cw_r2_context_targets.json").read_text())
        account = os.environ["R2_ACCOUNT_ID"]
        bucket = os.environ["R2_BUCKET"]
        client = boto3.client(
            "s3", endpoint_url=f"https://{account}.r2.cloudflarestorage.com",
            region_name="auto",
            config=Config(retries={"max_attempts": 2}, connect_timeout=10, read_timeout=30),
        )
        inventory = r2_inventory(client, bucket, audit)
        missing = set(targets) - inventory.keys()
        audit.report["coverage"].update(listed=len(inventory), selected=len(targets))
        if missing:
            audit.gap("target_version_unavailable", len(missing))
        for fingerprint in targets:
            audit.budget()
            if fingerprint in missing:
                continue
            obj = inventory[fingerprint]
            if obj["Size"] > MAX_BYTES:
                audit.gap("r2_object_size_limit")
                continue
            try:
                response = client.get_object(Bucket=bucket, Key=obj["Key"], IfMatch=obj["ETag"])
                with contextlib.closing(response["Body"]) as body:
                    data = body.read(MAX_BYTES + 1)
                if len(data) != obj["Size"]:
                    audit.gap("r2_size_mismatch")
                    continue
                audit.scan(data, obj["Key"], "r2-" + fingerprint)
                audit.done.add(fingerprint)
            except Incomplete:
                raise
            except Exception:
                audit.gap("r2_object_read_or_scan_failed")
        if set(inventory) != set(r2_inventory(client, bucket, audit)):
            audit.gap("r2_inventory_changed_during_scan")
    except Incomplete as error:
        audit.gap(str(error))
    except Exception as error:
        audit.gap("execution_" + type(error).__name__)
    return audit.finish()


if __name__ == "__main__":
    raise SystemExit(main())
