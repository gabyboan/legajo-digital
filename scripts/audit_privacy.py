"""Audit reachable Git history and candidate files without printing sensitive values.

Reference CSVs remain local. Reports contain paths, object IDs and counts only.
This detects known records and common secret formats, not every possible secret.
"""
from __future__ import annotations

import argparse
import base64
import csv
import json
from pathlib import Path
import re
import subprocess
import unicodedata


SECRET_PATTERNS = {
    "private_key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----"),
    "github_token": re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})\b"),
    "supabase_secret": re.compile(r"\bsb_secret_[A-Za-z0-9_-]{20,}\b"),
    "database_password_url": re.compile(r"postgres(?:ql)?://[^\s:/]+:[^\s@]+@", re.I),
    "aws_access_key": re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b"),
    "google_api_key": re.compile(r"\bAIza[A-Za-z0-9_-]{35}\b"),
    "slack_token": re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{20,}\b"),
}
LOCAL_PATH = re.compile(r"(?:^|/)(?:\.env(?:\.[^/]+)?|__pycache__|\.wrangler|\.runtime|\.venv|venv)(?:/|$)|\.py[co]$")
IMPORT_PATH = re.compile(r"^(?:supabase/imports|exportaciones)/")


def git(repo: Path, *args: str) -> bytes:
    return subprocess.run(["git", "-C", str(repo), *args], check=True, capture_output=True).stdout


def normalize(value: str) -> str:
    plain = "".join(c for c in unicodedata.normalize("NFD", value.casefold()) if not unicodedata.combining(c))
    return " ".join(re.findall(r"\w+", plain))


def references(paths: list[Path]) -> tuple[set[str], set[str]]:
    documents, names = set(), set()
    for path in paths:
        with path.open(encoding="utf-8-sig", newline="") as handle:
            for row in csv.DictReader(handle):
                dni = re.sub(r"\D", "", row.get("dni", ""))
                if 7 <= len(dni) <= 8:
                    documents.add(dni)
                name = normalize(row.get("apellido_nombres", ""))
                if len(name.split()) >= 2:
                    names.add(name)
    return documents, names


def inspect(data: bytes, path: str, documents: set[str], names: set[str]) -> dict[str, int]:
    result = {}
    if LOCAL_PATH.search(path) and Path(path).name != ".env.example":
        result["local_artifact"] = 1
    if IMPORT_PATH.search(path) and Path(path).name != ".gitignore":
        result["personnel_import_or_export"] = 1
    text = data.decode("utf-8", errors="replace")
    for label, pattern in SECRET_PATTERNS.items():
        count = len(pattern.findall(text))
        if count:
            result[label] = count
    privileged = 0
    for token in re.finditer(r"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+", text):
        payload = token[0].split(".")[1]
        try:
            decoded = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
            privileged += isinstance(decoded, dict) and decoded.get("role") == "service_role"
        except (ValueError, UnicodeDecodeError):
            pass
    if privileged:
        result["supabase_service_role_jwt"] = privileged
    # Match known DNI and the DNI embedded in a CUIT/CUIL, including formatting.
    numbers = {re.sub(r"\D", "", match[0]) for match in re.finditer(
        r"(?<![\w])(?:\d{7,11}|\d{1,2}\.\d{3}\.\d{3}|\d{2}-\d{7,8}-\d)(?![\w])", text
    )}
    numbers |= {value[2:10] for value in numbers if len(value) == 11}
    matched = len(numbers & documents)
    if matched:
        result["known_personnel_documents"] = matched
    if names:
        normalized = " " + normalize(text) + " "
        matched = sum(" " + name + " " in normalized for name in names)
        if matched:
            result["known_personnel_names"] = matched
    return result


def audit(repo: Path, reference_paths: list[Path], history: bool, working: bool) -> dict:
    documents, names = references(reference_paths)
    report = {
        "scope": {"history": history, "working_tree": working, "known_documents": len(documents), "known_names": len(names)},
        "history": {"commits": 0, "blobs": 0, "findings": [], "metadata_findings": []},
        "working_tree": {"files": 0, "findings": []},
    }
    if history:
        commits = git(repo, "rev-list", "--all", "--reflog").decode().splitlines()
        objects: dict[str, set[str]] = {}
        for commit in commits:
            for record in git(repo, "ls-tree", "-rz", commit).split(b"\0"):
                if not record:
                    continue
                metadata, path = record.split(b"\t", 1)
                _, kind, oid = metadata.split()
                if kind == b"blob":
                    objects.setdefault(oid.decode(), set()).add(path.decode("utf-8"))
            metadata = git(repo, "show", "-s", "--format=%B%n%an%n%ae%n%cn%n%ce", commit)
            findings = inspect(metadata, "commit-message", documents, names)
            if findings:
                report["history"]["metadata_findings"].append({"commit": commit, "kinds": findings})
        for oid, paths in sorted(objects.items()):
            data = git(repo, "cat-file", "blob", oid)
            for path in sorted(paths):
                findings = inspect(data, path, documents, names)
                if findings:
                    report["history"]["findings"].append({"path": path, "blob": oid, "kinds": findings})
        report["history"].update(commits=len(commits), blobs=len(objects))
    if working:
        paths = git(repo, "ls-files", "--cached", "--others", "--exclude-standard", "--deduplicate", "-z")
        for encoded in paths.split(b"\0"):
            if not encoded:
                continue
            path = encoded.decode("utf-8")
            target = repo / path
            if not target.is_file():
                continue
            report["working_tree"]["files"] += 1
            findings = inspect(target.read_bytes(), path, documents, names)
            if findings:
                report["working_tree"]["findings"].append({"path": path, "kinds": findings})
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    parser.add_argument("--reference-csv", action="append", type=Path, default=[])
    parser.add_argument("--working-only", action="store_true")
    parser.add_argument("--history-only", action="store_true")
    parser.add_argument("--report", type=Path, required=True, help="Local report path; keep under .runtime/")
    args = parser.parse_args()
    if args.working_only and args.history_only:
        parser.error("Choose one scope or neither")
    report = audit(args.repo.resolve(), args.reference_csv, not args.working_only, not args.history_only)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    history, working = report["history"], report["working_tree"]
    count = len(history["findings"]) + len(history["metadata_findings"]) + len(working["findings"])
    print(f"Commits: {history['commits']}; blobs: {history['blobs']}; current files: {working['files']}; findings: {count}")
    raise SystemExit(1 if count else 0)


if __name__ == "__main__":
    main()
