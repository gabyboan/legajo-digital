"""Regression checks for the privacy audit using only synthetic records."""
import base64
import json
from pathlib import Path
import tempfile
import unittest

import audit_privacy as audit_module


class PrivacyAuditTest(unittest.TestCase):
    def test_identifiers_and_redaction(self):
        documents, names = {"98765432"}, {"persona ficticia"}
        content = "Persona Ficticia | 98.765.432 | 20987654321 | 20-98765432-1"
        result = audit_module.inspect(content.encode(), "example.txt", documents, names)
        self.assertEqual(result["known_personnel_documents"], 1)
        self.assertEqual(result["known_personnel_names"], 1)
        self.assertNotIn("98765432", json.dumps(result))
        self.assertNotIn("Persona Ficticia", json.dumps(result))
        self.assertEqual(audit_module.inspect(b"987654320", "example.txt", documents, names), {})

    def test_public_and_privileged_keys(self):
        def jwt(role):
            payload = base64.urlsafe_b64encode(json.dumps({"role": role}).encode()).decode().rstrip("=")
            return "eyJhbGciOiJIUzI1NiJ9." + payload + ".synthetic-signature"

        self.assertEqual(audit_module.inspect(jwt("anon").encode(), "key.txt", set(), set()), {})
        result = audit_module.inspect(jwt("service_role").encode(), "key.txt", set(), set())
        self.assertEqual(result, {"supabase_service_role_jwt": 1})
        secret = "_".join(["sb", "secret", "x" * 24])
        self.assertEqual(audit_module.inspect(secret.encode(), "key.txt", set(), set()), {"supabase_secret": 1})

    def test_deleted_records_remain_in_history(self):
        with tempfile.TemporaryDirectory(prefix="legajo-privacy-test-") as name:
            root = Path(name).resolve()
            # Verify the cleanup target is the temporary directory created for this test.
            self.assertEqual(root.parent, Path(tempfile.gettempdir()).resolve())
            self.assertTrue(root.name.startswith("legajo-privacy-test-"))
            audit_module.git(root, "init", "--quiet")
            audit_module.git(root, "config", "user.name", "Privacy Test")
            audit_module.git(root, "config", "user.email", "test@example.invalid")
            audit_module.git(root, "config", "core.autocrlf", "false")
            reference = root / "reference.csv"
            reference.write_text("dni,apellido_nombres\n98765432,Persona Ficticia\n", encoding="utf-8")
            (root / ".gitignore").write_text("reference.csv\n", encoding="utf-8")
            personal = root / "personal.txt"
            personal.write_text("Persona Ficticia | 98765432", encoding="utf-8")
            audit_module.git(root, "add", ".")
            audit_module.git(root, "commit", "--quiet", "-m", "Synthetic fixture")
            audit_module.git(root, "rm", "--quiet", "personal.txt")
            audit_module.git(root, "commit", "--quiet", "-m", "Remove fixture")
            report = audit_module.audit(root, [reference], True, True)
            self.assertEqual(report["history"]["commits"], 2)
            self.assertTrue(report["history"]["findings"])
            self.assertEqual(report["working_tree"]["findings"], [])


if __name__ == "__main__":
    unittest.main()
