"""Review current R2 candidates and missing objects using a saved audit."""
import collections
import contextlib
import os

from cw_data_audit import Audit, HTTP, Incomplete, MAX_BYTES, category, restore, r2_inventory

TECHNICAL = {
    "roundRobinDrawsPendingCertification",
    "roundRobinGroupCertificationRequired",
}
IDENTIFIERS = {"membershipCard", "competitionId", "tournamentId", "playerId"}


class Review(Audit):
    def json_value(self, value, counts, depth=0):
        if depth > 80:
            self.gap("json_depth")
            return
        if isinstance(value, dict):
            for key, child in value.items():
                group = category(key)
                if group in {"medical", "phone", "email"} and child not in (None, "", [], {}):
                    label = "technical_medical" if key in TECHNICAL else group + "_field"
                    counts[label] += 1
                if key in IDENTIFIERS and isinstance(child, (str, int)):
                    matches = collections.Counter()
                    super().json_value(str(child), matches, depth + 1)
                    counts["mobile_pattern_in_identifier"] += matches.pop("italian_mobile_candidate", 0)
                    counts.update(matches)
                else:
                    self.json_value(child, counts, depth + 1)
        elif isinstance(value, list):
            for child in value:
                self.json_value(child, counts, depth + 1)
        else:
            super().json_value(str(value) if type(value) is int else value, counts, depth)


def flagged(counts):
    return any(
        value and any(term in key for term in ("mobile", "phone", "email", "medical"))
        for key, value in counts.items()
    )


def main():
    import boto3
    from botocore.config import Config

    os.umask(0o077)
    audit = Review("r2", "audit-review", 55 * 60)
    previous = Audit("r2", "audit-review/checkpoint-input")
    try:
        restore(previous, HTTP(previous), "42024562917")
        account = os.environ["R2_ACCOUNT_ID"]
        bucket = os.environ["R2_BUCKET"]
        client = boto3.client(
            "s3", endpoint_url=f"https://{account}.r2.cloudflarestorage.com",
            region_name="auto",
            config=Config(retries={"max_attempts": 2}, connect_timeout=10, read_timeout=30),
        )
        inventory = r2_inventory(client, bucket, audit)
        candidates = {
            source.removeprefix("r2-")
            for source, counts in previous.report["sources"].items()
            if source.startswith("r2-") and flagged(counts)
        }
        targets = (set(inventory) - previous.done) | (candidates & inventory.keys())
        audit.report["coverage"].update(
            listed=len(inventory), selected=len(targets),
            historicalCandidatesUnavailable=len(candidates - inventory.keys()),
        )
        for fingerprint in sorted(targets):
            audit.budget()
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
        if candidates - inventory.keys():
            audit.gap("historical_candidate_unavailable", len(candidates - inventory.keys()))
        # The old report aggregates parser gaps without object fingerprints.
        for reason, count in previous.report["gaps"].items():
            if reason not in {"r2_object_read_failed", "r2_inventory_changed_during_scan"}:
                audit.gap("previous_" + reason, count)
    except Incomplete as error:
        audit.gap(str(error))
    except Exception as error:
        audit.gap("execution_" + type(error).__name__)
    return audit.finish()


if __name__ == "__main__":
    raise SystemExit(main())
