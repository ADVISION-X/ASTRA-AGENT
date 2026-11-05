"""Run inside the authorized Work workspace; never relay production bytes via AGENT."""
import hashlib
import json
import pathlib
import sys
import datetime
import urllib.error
import urllib.request
import zipfile
import xml.etree.ElementTree as ET


def digest(data):
    return "sha256:" + hashlib.sha256(data).hexdigest()


def read_remote(grant):
    try:
        request = urllib.request.Request(grant["get_url"], method="GET")
        with urllib.request.urlopen(request, timeout=120) as response:
            data = response.read()
        return "present", len(data), digest(data)
    except urllib.error.HTTPError as error:
        return ("absent" if error.code == 404 else "unknown"), None, None
    except (OSError, TimeoutError):
        return "unknown", None, None


def verify_container(path, purpose):
    with zipfile.ZipFile(path) as archive:
        if archive.testzip() is not None:
            raise ValueError("PACKAGE_CRC_INVALID")
        for name in archive.namelist():
            member = pathlib.PurePosixPath(name)
            if member.is_absolute() or ".." in member.parts:
                raise ValueError("PACKAGE_MEMBER_PATH_INVALID")
        if purpose == "delivery_docx":
            ET.fromstring(archive.read("[Content_Types].xml"))
            ET.fromstring(archive.read("word/document.xml"))


def transfer(item, root):
    path = (root / item["path"]).resolve(strict=True)
    if not path.is_relative_to(root) or not path.is_file():
        raise ValueError("WORKSPACE_FILE_IDENTITY_INVALID")
    data = path.read_bytes()
    grant = item["grant"]
    if len(data) != grant["bytes"] or digest(data) != grant["sha256"]:
        raise ValueError("WORKSPACE_BYTES_MISMATCH")
    if item["purpose"] in ("delivery_docx", "delivery_zip"):
        verify_container(path, item["purpose"])
    result = {"asset_id": grant["asset_id"], "object_key": grant["object_key"],
              "bytes": len(data), "sha256": digest(data),
              "upload_state": "not_started", "readback_state": "unknown"}
    state, size, sha = read_remote(grant)
    if state == "present":
        result["upload_state"] = "unknown"
        result["readback_state"] = "verified" if (size, sha) == (len(data), digest(data)) else "mismatch"
        return result
    if state != "absent" or not grant.get("put_url"):
        return result
    expires = datetime.datetime.fromisoformat(grant["expires_at"].replace("Z", "+00:00"))
    headers = {key.lower(): value for key, value in grant["required_put_headers"].items()}
    if expires <= datetime.datetime.now(datetime.timezone.utc) or headers.get("if-none-match") != "*":
        raise ValueError("CONDITIONAL_UPLOAD_AUTHORIZATION_INVALID")
    request = urllib.request.Request(grant["put_url"], data=data, method="PUT",
                                     headers=grant["required_put_headers"])
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            response.read()
        result["upload_state"] = "confirmed"
    except urllib.error.HTTPError as error:
        result["upload_state"] = "rejected" if error.code in (400, 401, 403, 404, 409, 413, 415, 422) else "unknown"
    except (OSError, TimeoutError):
        result["upload_state"] = "unknown"
    state, size, sha = read_remote(grant)
    if state == "present":
        result["readback_state"] = "verified" if (size, sha) == (len(data), digest(data)) else "mismatch"
    return result


def main():
    config = json.loads(pathlib.Path(sys.argv[1]).read_text())
    root = pathlib.Path(config["workspace_root"]).resolve(strict=True)
    results = []
    for item in config["files"]:
        try:
            results.append(transfer(item, root))
        except (OSError, ValueError, KeyError, zipfile.BadZipFile, ET.ParseError):
            results.append({"asset_id": item.get("grant", {}).get("asset_id"),
                            "upload_state": "not_started", "readback_state": "unknown",
                            "error": "LOCAL_FILE_VALIDATION_FAILED"})
    report = {"schema_version": "astra-work-archive-report.v1", "files": results}
    destination = (root / config["report_path"]).resolve()
    if not destination.is_relative_to(root):
        raise ValueError("REPORT_PATH_INVALID")
    destination.write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps({"report_path": str(destination), "bytes": destination.stat().st_size,
                      "sha256": digest(destination.read_bytes())}))


if __name__ == "__main__":
    main()
