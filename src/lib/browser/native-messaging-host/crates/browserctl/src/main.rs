use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::env;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};
use std::process;
use std::time::{SystemTime, UNIX_EPOCH};

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

const PROTOCOL_VERSION: &str = "grasseye-browser-v2";
const RELEASE_IDENTITY: &str = "grasseye-browser-runtime-2026-08-18-v2";
const EXTENSION_ID: &str = "mepfnlhndaiihhfejbbhfehegpbdnipl";
const HOST_NAME: &str = "com.grasseye.browser";
const HOST_BINARY_NAME: &str = "grasseye-browser-host";
const ARTIFACT_SET_SCHEMA_VERSION: &str = "grasseye-browser-artifact-set-v2";
const RELEASE_SEQUENCE: u64 = 3;
const MINIMUM_ACCEPTED_RELEASE_SEQUENCE: u64 = 3;
const ED25519_SPKI_PREFIX: &[u8] = b"\x30\x2a\x30\x05\x06\x03\x2b\x65\x70\x03\x21\x00";

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HostConnectionConfig {
    protocol_version: String,
    release_identity: String,
    extension_id: String,
    socket_path: String,
    profile_ref: String,
    user_data_dir: String,
    profile_directory: String,
    chrome_executable_path: String,
    runtime_mode: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ActivationReceipt {
    schema_version: String,
    release_identity: String,
    release_sequence: u64,
    minimum_accepted_release_sequence: u64,
    protocol_version: String,
    extension_id: String,
    extension_tree_sha256: String,
    artifact_set_sha256: String,
    profile_enrollment_id: String,
    profile_ref: String,
    user_data_dir: String,
    profile_directory: String,
    chrome_executable_path: String,
    host_path: String,
    host_sha256: String,
    controller_socket_path: String,
    activated_at_unix_ms: u128,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ArtifactBinary {
    path: String,
    sha256: String,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ArtifactExtension {
    path: String,
    manifest_sha256: String,
    tree_sha256: String,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ArtifactSet {
    schema_version: String,
    release_identity: String,
    release_sequence: u64,
    minimum_accepted_release_sequence: u64,
    protocol_version: String,
    extension_id: String,
    artifact_mode: String,
    platform_arch: String,
    source_commit_sha: String,
    builder_identity: String,
    host: ArtifactBinary,
    browserctl: ArtifactBinary,
    extension: ArtifactExtension,
}

#[derive(Debug)]
struct VerifiedArtifactSet {
    manifest: ArtifactSet,
    artifact_set_sha256: String,
    host_path: PathBuf,
}

#[derive(Debug, Serialize)]
struct ExtensionTreeFile {
    path: String,
    size: u64,
    sha256: String,
}

#[derive(Debug, Serialize)]
struct ExtensionTreeIdentity {
    files: Vec<ExtensionTreeFile>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ProfileEnrollmentReceipt {
    schema_version: String,
    profile_enrollment_id: String,
    platform: String,
    profile_ref: String,
    user_data_dir: String,
    profile_directory: String,
    chrome_executable_path: String,
    extension_id: String,
    release_identity: String,
    local_state_hash: String,
    enrolled_at_unix_ms: u128,
}

fn fail(code: &str, detail: impl AsRef<str>) -> ! {
    eprintln!("{}", serde_json::json!({ "status": "BLOCKED", "code": code, "reason": detail.as_ref() }));
    process::exit(1)
}

fn required_env(name: &str) -> String {
    env::var(name)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| fail("BROWSERCTL_REQUIRED_ENV_MISSING", name))
}

fn requested_runtime_mode() -> String {
    let mode = env::var("GRASSEYE_BROWSER_RUNTIME_MODE")
        .unwrap_or_else(|_| "production".to_string())
        .trim()
        .to_string();
    if mode != "production" && mode != "test" {
        fail("BROWSER_RUNTIME_MODE_INVALID", mode);
    }
    mode
}

fn home_dir() -> PathBuf {
    env::var_os("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| fail("BROWSERCTL_HOME_MISSING", "HOME is not set"))
}

fn grass_eye_root() -> PathBuf {
    #[cfg(target_os = "macos")]
    {
        return home_dir().join("Library").join("Application Support").join("GrassEye");
    }
    #[cfg(target_os = "linux")]
    {
        return home_dir().join(".config").join("grasseye");
    }
    #[allow(unreachable_code)]
    home_dir().join(".grasseye")
}

fn chrome_manifest_dirs() -> Vec<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        let root = home_dir().join("Library").join("Application Support").join("Google");
        return vec![
            root.join("Chrome").join("NativeMessagingHosts"),
            root.join("Chrome for Testing").join("NativeMessagingHosts"),
        ];
    }
    #[cfg(target_os = "linux")]
    {
        let root = home_dir().join(".config");
        return vec![
            root.join("google-chrome").join("NativeMessagingHosts"),
            root.join("google-chrome-for-testing").join("NativeMessagingHosts"),
        ];
    }
    #[allow(unreachable_code)]
    Vec::new()
}

fn sha256_file(path: &Path) -> String {
    let mut file = File::open(path)
        .unwrap_or_else(|error| fail("BROWSERCTL_HASH_READ_FAILED", format!("{}: {error}", path.display())));
    let mut hash = Sha256::new();
    let mut buffer = [0_u8; 256 * 1024];
    loop {
        let count = file.read(&mut buffer)
            .unwrap_or_else(|error| fail("BROWSERCTL_HASH_READ_FAILED", error.to_string()));
        if count == 0 {
            break;
        }
        hash.update(&buffer[..count]);
    }
    let digest = hash.finalize();
    let hex = digest.iter().map(|byte| format!("{byte:02x}")).collect::<String>();
    format!("sha256:{hex}")
}

fn sha256_bytes(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    let hex = digest.iter().map(|byte| format!("{byte:02x}")).collect::<String>();
    format!("sha256:{hex}")
}

fn artifact_platform_arch() -> String {
    let platform = if env::consts::OS == "macos" { "darwin" } else { env::consts::OS };
    let architecture = if env::consts::ARCH == "aarch64" { "arm64" } else { env::consts::ARCH };
    format!("{platform}-{architecture}")
}

fn artifact_root() -> PathBuf {
    let executable = env::current_exe()
        .unwrap_or_else(|error| fail("BROWSERCTL_CURRENT_EXE_FAILED", error.to_string()));
    let bin_dir = executable.parent()
        .unwrap_or_else(|| fail("BROWSERCTL_ARTIFACT_ROOT_INVALID", executable.display().to_string()));
    let root = bin_dir.parent()
        .unwrap_or_else(|| fail("BROWSERCTL_ARTIFACT_ROOT_INVALID", executable.display().to_string()));
    if !root.join("browser-artifact-set.json").is_file() {
        fail("BROWSERCTL_ARTIFACT_ROOT_INVALID", root.display().to_string());
    }
    root.to_path_buf()
}

fn artifact_path(root: &Path, relative: &str) -> PathBuf {
    let candidate = Path::new(relative);
    if candidate.is_absolute() || candidate.components().any(|part| !matches!(part, Component::Normal(_))) {
        fail("BROWSERCTL_ARTIFACT_PATH_INVALID", relative);
    }
    root.join(candidate)
}

fn public_key_bytes_from_pem(pem: &str) -> [u8; 32] {
    let payload = pem.lines()
        .filter(|line| !line.starts_with("---"))
        .collect::<String>();
    let der = BASE64_STANDARD.decode(payload)
        .unwrap_or_else(|error| fail("BROWSER_ARTIFACT_PUBLIC_KEY_INVALID", error.to_string()));
    if der.len() != ED25519_SPKI_PREFIX.len() + 32 || !der.starts_with(ED25519_SPKI_PREFIX) {
        fail("BROWSER_ARTIFACT_PUBLIC_KEY_INVALID", "expected Ed25519 SPKI public key");
    }
    let mut key = [0_u8; 32];
    key.copy_from_slice(&der[ED25519_SPKI_PREFIX.len()..]);
    key
}

fn artifact_public_key(root: &Path, mode: &str) -> String {
    if mode == "test" {
        return fs::read_to_string(root.join("browser-artifact-set.test-public-key.pem"))
            .unwrap_or_else(|error| fail("BROWSER_TEST_RELEASE_PUBLIC_KEY_REQUIRED", error.to_string()));
    }
    env::var("GRASSEYE_BROWSER_RELEASE_PUBLIC_KEY_PEM")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| fail("BROWSER_RELEASE_PUBLIC_KEY_REQUIRED", "GRASSEYE_BROWSER_RELEASE_PUBLIC_KEY_PEM"))
}

fn verify_artifact_signature(root: &Path, manifest_bytes: &[u8], mode: &str) {
    let signature_bytes = fs::read(root.join("browser-artifact-set.sig"))
        .unwrap_or_else(|error| fail("BROWSER_ARTIFACT_SIGNATURE_FILES_REQUIRED", error.to_string()));
    let key = VerifyingKey::from_bytes(&public_key_bytes_from_pem(&artifact_public_key(root, mode)))
        .unwrap_or_else(|error| fail("BROWSER_ARTIFACT_PUBLIC_KEY_INVALID", error.to_string()));
    let signature = Signature::from_slice(&signature_bytes)
        .unwrap_or_else(|error| fail("BROWSER_ARTIFACT_SIGNATURE_INVALID", error.to_string()));
    key.verify(manifest_bytes, &signature)
        .unwrap_or_else(|error| fail("BROWSER_ARTIFACT_SIGNATURE_INVALID", error.to_string()));
}

fn relative_posix_path(root: &Path, candidate: &Path) -> String {
    let relative = candidate.strip_prefix(root)
        .unwrap_or_else(|_| fail("BROWSER_EXTENSION_TREE_PATH_INVALID", candidate.display().to_string()));
    let mut parts = Vec::new();
    for part in relative.components() {
        match part {
            Component::Normal(segment) => parts.push(segment.to_str()
                .unwrap_or_else(|| fail("BROWSER_EXTENSION_TREE_PATH_INVALID", candidate.display().to_string()))),
            _ => fail("BROWSER_EXTENSION_TREE_PATH_INVALID", candidate.display().to_string()),
        }
    }
    if parts.is_empty() {
        fail("BROWSER_EXTENSION_TREE_PATH_INVALID", candidate.display().to_string());
    }
    parts.join("/")
}

fn collect_extension_tree(root: &Path, directory: &Path, files: &mut Vec<ExtensionTreeFile>) {
    let mut entries = fs::read_dir(directory)
        .unwrap_or_else(|error| fail("BROWSER_EXTENSION_TREE_READ_FAILED", error.to_string()))
        .collect::<Result<Vec<_>, _>>()
        .unwrap_or_else(|error| fail("BROWSER_EXTENSION_TREE_READ_FAILED", error.to_string()));
    entries.sort_by(|left, right| left.file_name().cmp(&right.file_name()));
    for entry in entries {
        let candidate = entry.path();
        let metadata = fs::symlink_metadata(&candidate)
            .unwrap_or_else(|error| fail("BROWSER_EXTENSION_TREE_READ_FAILED", error.to_string()));
        if metadata.file_type().is_symlink() {
            fail("BROWSER_EXTENSION_TREE_SYMLINK_FORBIDDEN", candidate.display().to_string());
        }
        if metadata.is_dir() {
            collect_extension_tree(root, &candidate, files);
        } else if metadata.is_file() {
            files.push(ExtensionTreeFile {
                path: relative_posix_path(root, &candidate),
                size: metadata.len(),
                sha256: sha256_file(&candidate),
            });
        } else {
            fail("BROWSER_EXTENSION_TREE_SPECIAL_FILE_FORBIDDEN", candidate.display().to_string());
        }
    }
}

fn extension_tree_sha256(root: &Path) -> String {
    let metadata = fs::symlink_metadata(root)
        .unwrap_or_else(|error| fail("BROWSER_EXTENSION_TREE_ROOT_INVALID", error.to_string()));
    if !metadata.is_dir() || metadata.file_type().is_symlink() {
        fail("BROWSER_EXTENSION_TREE_ROOT_INVALID", root.display().to_string());
    }
    let mut files = Vec::new();
    collect_extension_tree(root, root, &mut files);
    files.sort_by(|left, right| left.path.cmp(&right.path));
    let canonical = serde_json::to_vec(&ExtensionTreeIdentity { files })
        .unwrap_or_else(|error| fail("BROWSER_EXTENSION_TREE_SERIALIZATION_FAILED", error.to_string()));
    sha256_bytes(&canonical)
}

fn verified_artifact_set() -> VerifiedArtifactSet {
    let root = artifact_root();
    let mode = requested_runtime_mode();
    let manifest_bytes = fs::read(root.join("browser-artifact-set.json"))
        .unwrap_or_else(|error| fail("BROWSER_ARTIFACT_READ_FAILED", error.to_string()));
    verify_artifact_signature(&root, &manifest_bytes, &mode);
    let manifest: ArtifactSet = serde_json::from_slice(&manifest_bytes)
        .unwrap_or_else(|error| fail("BROWSER_ARTIFACT_INVALID", error.to_string()));
    if manifest.schema_version != ARTIFACT_SET_SCHEMA_VERSION
        || manifest.release_identity != RELEASE_IDENTITY
        || manifest.release_sequence != RELEASE_SEQUENCE
        || manifest.release_sequence < MINIMUM_ACCEPTED_RELEASE_SEQUENCE
        || manifest.minimum_accepted_release_sequence != MINIMUM_ACCEPTED_RELEASE_SEQUENCE
        || manifest.protocol_version != PROTOCOL_VERSION
        || manifest.extension_id != EXTENSION_ID
        || manifest.artifact_mode != mode
        || manifest.platform_arch != artifact_platform_arch()
        || manifest.source_commit_sha == "UNBOUND"
        || manifest.builder_identity == "UNBOUND"
    {
        fail("BROWSER_ARTIFACT_RELEASE_TUPLE_INVALID", "artifact release tuple does not match browserctl");
    }
    let host_path = artifact_path(&root, &manifest.host.path);
    let browserctl_path = artifact_path(&root, &manifest.browserctl.path);
    let extension_path = artifact_path(&root, &manifest.extension.path);
    let current_executable = env::current_exe()
        .unwrap_or_else(|error| fail("BROWSERCTL_CURRENT_EXE_FAILED", error.to_string()));
    if sha256_file(&host_path) != manifest.host.sha256
        || sha256_file(&browserctl_path) != manifest.browserctl.sha256
        || sha256_file(&current_executable) != manifest.browserctl.sha256
        || !extension_path.join("manifest.json").is_file()
        || sha256_file(&extension_path.join("manifest.json")) != manifest.extension.manifest_sha256
        || extension_tree_sha256(&extension_path) != manifest.extension.tree_sha256
    {
        fail("BROWSER_ARTIFACT_HASH_MISMATCH", "artifact bytes do not match signed ArtifactSet");
    }
    VerifiedArtifactSet {
        manifest,
        artifact_set_sha256: sha256_bytes(&manifest_bytes),
        host_path,
    }
}

fn stable_local_state_identity_hash(local_state_path: &Path, profile_directory: &str) -> String {
    let bytes = fs::read(local_state_path)
        .unwrap_or_else(|error| fail("BROWSER_PROFILE_LOCAL_STATE_READ_FAILED", format!("{}: {error}", local_state_path.display())));
    let state: serde_json::Value = serde_json::from_slice(&bytes)
        .unwrap_or_else(|error| fail("BROWSER_PROFILE_LOCAL_STATE_INVALID", error.to_string()));
    let info = state
        .get("profile")
        .and_then(|value| value.get("info_cache"))
        .and_then(|value| value.get(profile_directory));
    let identity = serde_json::json!({
        "profileDirectory": profile_directory,
        "profileInfo": {
            "gaiaId": info.and_then(|value| value.get("gaia_id")).cloned().unwrap_or(serde_json::Value::Null),
            "name": info.and_then(|value| value.get("name")).cloned().unwrap_or(serde_json::Value::Null),
            "userName": info.and_then(|value| value.get("user_name")).cloned().unwrap_or(serde_json::Value::Null),
        },
    });
    sha256_bytes(serde_json::to_string(&identity).unwrap().as_bytes())
}

fn write_atomic(path: &Path, bytes: &[u8], mode: u32) {
    let parent = path.parent().unwrap_or_else(|| fail("BROWSERCTL_PATH_INVALID", path.display().to_string()));
    fs::create_dir_all(parent)
        .unwrap_or_else(|error| fail("BROWSERCTL_MKDIR_FAILED", format!("{}: {error}", parent.display())));
    let temp = parent.join(format!(".{}.tmp-{}", path.file_name().unwrap().to_string_lossy(), process::id()));
    let mut file = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&temp)
        .unwrap_or_else(|error| fail("BROWSERCTL_TEMP_CREATE_FAILED", format!("{}: {error}", temp.display())));
    file.write_all(bytes)
        .unwrap_or_else(|error| fail("BROWSERCTL_WRITE_FAILED", error.to_string()));
    file.sync_all()
        .unwrap_or_else(|error| fail("BROWSERCTL_FSYNC_FAILED", error.to_string()));
    #[cfg(unix)]
    fs::set_permissions(&temp, fs::Permissions::from_mode(mode))
        .unwrap_or_else(|error| fail("BROWSERCTL_CHMOD_FAILED", error.to_string()));
    fs::rename(&temp, path)
        .unwrap_or_else(|error| fail("BROWSERCTL_ATOMIC_RENAME_FAILED", format!("{}: {error}", path.display())));
    if let Ok(directory) = File::open(parent) {
        let _ = directory.sync_all();
    }
}

fn data_dir_from_args() -> PathBuf {
    let args: Vec<String> = env::args().collect();
    for window in args.windows(2) {
        if window[0] == "--data-dir" {
            return PathBuf::from(&window[1]);
        }
    }
    env::var_os("GRASSEYE_DATA_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| env::current_dir().unwrap_or_else(|error| fail("BROWSERCTL_CWD_FAILED", error.to_string())).join(".grasseye-local"))
}

fn installed_host_path(artifact_set_sha256: &str) -> PathBuf {
    let artifact_directory = artifact_set_sha256
        .strip_prefix("sha256:")
        .filter(|value| value.len() == 64)
        .unwrap_or_else(|| fail("BROWSER_ARTIFACT_SET_IDENTITY_INVALID", artifact_set_sha256));
    grass_eye_root()
        .join("browser-runtime")
        .join("releases")
        .join(RELEASE_IDENTITY)
        .join(artifact_directory)
        .join("bin")
        .join(HOST_BINARY_NAME)
}

fn connection_config_path() -> PathBuf {
    grass_eye_root().join("browser-native-host.json")
}

fn activation_receipt_path() -> PathBuf {
    grass_eye_root().join("browser-runtime").join("active-activation.json")
}

fn profile_enrollment_receipt_path() -> PathBuf {
    grass_eye_root()
        .join("browser-runtime")
        .join("profile-enrollment.json")
}

fn native_manifest_json(host_path: &Path) -> Vec<u8> {
    serde_json::to_vec_pretty(&serde_json::json!({
        "name": HOST_NAME,
        "description": "GrassEye authenticated browser runtime",
        "path": host_path.to_string_lossy(),
        "type": "stdio",
        "allowed_origins": [format!("chrome-extension://{EXTENSION_ID}/")]
    })).unwrap()
}

fn read_profile_enrollment() -> ProfileEnrollmentReceipt {
    let receipt_path = profile_enrollment_receipt_path();
    let bytes = fs::read(&receipt_path).unwrap_or_else(|error| {
        fail("BROWSER_PROFILE_ENROLLMENT_MISSING", format!("{}: {error}", receipt_path.display()))
    });
    let receipt: ProfileEnrollmentReceipt = serde_json::from_slice(&bytes)
        .unwrap_or_else(|error| fail("BROWSER_PROFILE_ENROLLMENT_INVALID", error.to_string()));
    if receipt.schema_version != "grasseye-browser-profile-enrollment-v1"
        || receipt.profile_enrollment_id.trim().is_empty()
        || receipt.platform != env::consts::OS
        || receipt.extension_id != EXTENSION_ID
        || receipt.release_identity != RELEASE_IDENTITY
        || receipt.profile_ref.trim().is_empty()
        || receipt.profile_directory.trim().is_empty()
    {
        fail("BROWSER_PROFILE_ENROLLMENT_TUPLE_INVALID", receipt_path.display().to_string());
    }
    let user_data_dir = Path::new(&receipt.user_data_dir);
    let chrome_executable = Path::new(&receipt.chrome_executable_path);
    if !user_data_dir.is_absolute() || !user_data_dir.is_dir() {
        fail("BROWSERCTL_USER_DATA_DIR_INVALID", user_data_dir.display().to_string());
    }
    if !chrome_executable.is_absolute() || !chrome_executable.is_file() {
        fail("BROWSERCTL_CHROME_EXECUTABLE_INVALID", chrome_executable.display().to_string());
    }
    let local_state_path = user_data_dir.join("Local State");
    if !local_state_path.is_file() {
        fail("BROWSER_PROFILE_LOCAL_STATE_MISSING", local_state_path.display().to_string());
    }
    if stable_local_state_identity_hash(&local_state_path, &receipt.profile_directory) != receipt.local_state_hash {
        fail("BROWSER_PROFILE_LOCAL_STATE_HASH_MISMATCH", local_state_path.display().to_string());
    }
    receipt
}

fn enrolled_profile_fields() -> ProfileEnrollmentReceipt {
    read_profile_enrollment()
}

fn enroll_profile() {
    let profile_ref = required_env("GRASSEYE_BROWSER_PROFILE_REF");
    let user_data_dir = PathBuf::from(required_env("GRASSEYE_CHROME_USER_DATA_DIR"));
    let profile_directory = required_env("GRASSEYE_BROWSER_PROFILE_DIRECTORY");
    let chrome_executable_path = PathBuf::from(required_env("GRASSEYE_CHROME_EXECUTABLE"));
    if !user_data_dir.is_absolute() || !user_data_dir.is_dir() {
        fail("BROWSERCTL_USER_DATA_DIR_INVALID", user_data_dir.display().to_string());
    }
    if !chrome_executable_path.is_absolute() || !chrome_executable_path.is_file() {
        fail("BROWSERCTL_CHROME_EXECUTABLE_INVALID", chrome_executable_path.display().to_string());
    }
    let local_state_path = user_data_dir.join("Local State");
    if !local_state_path.is_file() {
        fail("BROWSER_PROFILE_LOCAL_STATE_MISSING", local_state_path.display().to_string());
    }
    let local_state_hash = stable_local_state_identity_hash(&local_state_path, &profile_directory);
    let identity_material = serde_json::json!({
        "platform": env::consts::OS,
        "profileRef": profile_ref.clone(),
        "userDataDir": user_data_dir.clone(),
        "profileDirectory": profile_directory.clone(),
        "chromeExecutablePath": chrome_executable_path.clone(),
        "extensionId": EXTENSION_ID,
        "releaseIdentity": RELEASE_IDENTITY,
        "localStateHash": local_state_hash.clone(),
    });
    let receipt = ProfileEnrollmentReceipt {
        schema_version: "grasseye-browser-profile-enrollment-v1".to_string(),
        profile_enrollment_id: sha256_bytes(serde_json::to_string(&identity_material).unwrap().as_bytes()),
        platform: env::consts::OS.to_string(),
        profile_ref,
        user_data_dir: user_data_dir.to_string_lossy().to_string(),
        profile_directory,
        chrome_executable_path: chrome_executable_path.to_string_lossy().to_string(),
        extension_id: EXTENSION_ID.to_string(),
        release_identity: RELEASE_IDENTITY.to_string(),
        local_state_hash,
        enrolled_at_unix_ms: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis(),
    };
    write_atomic(
        &profile_enrollment_receipt_path(),
        format!("{}\n", serde_json::to_string_pretty(&receipt).unwrap()).as_bytes(),
        0o600,
    );
    println!("{}", serde_json::json!({
        "status": "ENROLLED",
        "profileEnrollmentId": receipt.profile_enrollment_id,
        "receiptPath": profile_enrollment_receipt_path(),
        "releaseIdentity": RELEASE_IDENTITY,
        "extensionId": EXTENSION_ID,
    }));
}

fn install() {
    let enrollment = enrolled_profile_fields();
    let artifact = verified_artifact_set();
    let source_hash = artifact.manifest.host.sha256.clone();
    let host_path = installed_host_path(&artifact.artifact_set_sha256);
    let host_bytes = fs::read(&artifact.host_path)
        .unwrap_or_else(|error| fail("BROWSERCTL_HOST_READ_FAILED", error.to_string()));
    write_atomic(&host_path, &host_bytes, 0o700);
    if sha256_file(&host_path) != source_hash {
        fail("BROWSERCTL_HOST_READBACK_MISMATCH", host_path.display().to_string());
    }

    let data_dir = data_dir_from_args();
    let socket_path = data_dir.join("browser-runtime").join("controller-native.sock");
    let config = HostConnectionConfig {
        protocol_version: PROTOCOL_VERSION.to_string(),
        release_identity: RELEASE_IDENTITY.to_string(),
        extension_id: EXTENSION_ID.to_string(),
        socket_path: socket_path.to_string_lossy().to_string(),
        profile_ref: enrollment.profile_ref.clone(),
        user_data_dir: enrollment.user_data_dir.clone(),
        profile_directory: enrollment.profile_directory.clone(),
        chrome_executable_path: enrollment.chrome_executable_path.clone(),
        runtime_mode: requested_runtime_mode(),
    };
    write_atomic(
        &connection_config_path(),
        format!("{}\n", serde_json::to_string_pretty(&config).unwrap()).as_bytes(),
        0o600,
    );

    let manifest = native_manifest_json(&host_path);
    for directory in chrome_manifest_dirs() {
        fs::create_dir_all(&directory)
            .unwrap_or_else(|error| fail("BROWSERCTL_MANIFEST_DIR_FAILED", format!("{}: {error}", directory.display())));
        write_atomic(&directory.join(format!("{HOST_NAME}.json")), &manifest, 0o600);
    }

    let activated_at_unix_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let receipt = ActivationReceipt {
        schema_version: "grasseye-browser-activation-v2".to_string(),
        release_identity: artifact.manifest.release_identity.clone(),
        release_sequence: artifact.manifest.release_sequence,
        minimum_accepted_release_sequence: artifact.manifest.minimum_accepted_release_sequence,
        protocol_version: artifact.manifest.protocol_version.clone(),
        extension_id: artifact.manifest.extension_id.clone(),
        extension_tree_sha256: artifact.manifest.extension.tree_sha256.clone(),
        artifact_set_sha256: artifact.artifact_set_sha256.clone(),
        profile_enrollment_id: enrollment.profile_enrollment_id.clone(),
        profile_ref: enrollment.profile_ref,
        user_data_dir: enrollment.user_data_dir,
        profile_directory: enrollment.profile_directory,
        chrome_executable_path: enrollment.chrome_executable_path,
        host_path: host_path.to_string_lossy().to_string(),
        host_sha256: source_hash.clone(),
        controller_socket_path: socket_path.to_string_lossy().to_string(),
        activated_at_unix_ms,
    };
    write_atomic(
        &activation_receipt_path(),
        format!("{}\n", serde_json::to_string_pretty(&receipt).unwrap()).as_bytes(),
        0o600,
    );

    println!("{}", serde_json::json!({
        "status": "INSTALLED",
        "releaseIdentity": RELEASE_IDENTITY,
        "protocolVersion": PROTOCOL_VERSION,
        "releaseSequence": RELEASE_SEQUENCE,
        "extensionId": EXTENSION_ID,
        "artifactSetSha256": artifact.artifact_set_sha256,
        "profileRef": receipt.profile_ref,
        "hostPath": host_path,
        "hostSha256": source_hash,
        "socketPath": socket_path,
    }));
}

fn verify() {
    let enrollment = enrolled_profile_fields();
    let artifact = verified_artifact_set();
    let host_path = installed_host_path(&artifact.artifact_set_sha256);
    if !host_path.is_file() {
        fail("BROWSERCTL_HOST_NOT_INSTALLED", host_path.display().to_string());
    }
    let receipt_bytes = fs::read(activation_receipt_path())
        .unwrap_or_else(|error| fail("BROWSERCTL_ACTIVATION_READ_FAILED", error.to_string()));
    let receipt: ActivationReceipt = serde_json::from_slice(&receipt_bytes)
        .unwrap_or_else(|error| fail("BROWSERCTL_ACTIVATION_INVALID", error.to_string()));
    if receipt.schema_version != "grasseye-browser-activation-v2"
        || receipt.release_identity != artifact.manifest.release_identity
        || receipt.release_sequence != artifact.manifest.release_sequence
        || receipt.minimum_accepted_release_sequence != artifact.manifest.minimum_accepted_release_sequence
        || receipt.protocol_version != artifact.manifest.protocol_version
        || receipt.extension_id != artifact.manifest.extension_id
        || receipt.extension_tree_sha256 != artifact.manifest.extension.tree_sha256
        || receipt.artifact_set_sha256 != artifact.artifact_set_sha256
        || receipt.profile_enrollment_id != enrollment.profile_enrollment_id
        || receipt.host_path != host_path.to_string_lossy()
        || receipt.host_sha256 != artifact.manifest.host.sha256
        || receipt.host_sha256 != sha256_file(&host_path)
        || !Path::new(&receipt.user_data_dir).is_absolute()
        || !Path::new(&receipt.chrome_executable_path).is_absolute()
    {
        fail("BROWSERCTL_ACTIVATION_MISMATCH", "activation receipt does not match installed host or enrolled profile");
    }
    let config_bytes = fs::read(connection_config_path())
        .unwrap_or_else(|error| fail("BROWSERCTL_CONFIG_READ_FAILED", error.to_string()));
    let config: HostConnectionConfig = serde_json::from_slice(&config_bytes)
        .unwrap_or_else(|error| fail("BROWSERCTL_CONFIG_INVALID", error.to_string()));
    if config.protocol_version != PROTOCOL_VERSION
        || config.release_identity != RELEASE_IDENTITY
        || config.extension_id != EXTENSION_ID
        || config.profile_ref != enrollment.profile_ref
        || config.user_data_dir != enrollment.user_data_dir
        || config.profile_directory != enrollment.profile_directory
        || config.chrome_executable_path != enrollment.chrome_executable_path
        || config.runtime_mode != requested_runtime_mode()
        || !Path::new(&config.socket_path).is_absolute()
    {
        fail("BROWSERCTL_CONFIG_MISMATCH", "connection config does not match activation receipt");
    }
    let expected_manifest = native_manifest_json(&host_path);
    for directory in chrome_manifest_dirs() {
        let manifest_path = directory.join(format!("{HOST_NAME}.json"));
        let actual = fs::read(&manifest_path)
            .unwrap_or_else(|error| fail("BROWSERCTL_MANIFEST_READ_FAILED", format!("{}: {error}", manifest_path.display())));
        if actual != expected_manifest {
            fail("BROWSERCTL_MANIFEST_MISMATCH", manifest_path.display().to_string());
        }
    }
    println!("{}", serde_json::json!({
        "status": "VERIFIED",
        "releaseIdentity": RELEASE_IDENTITY,
        "protocolVersion": PROTOCOL_VERSION,
        "extensionId": EXTENSION_ID,
        "releaseSequence": artifact.manifest.release_sequence,
        "artifactSetSha256": artifact.artifact_set_sha256,
        "profileEnrollmentId": enrollment.profile_enrollment_id,
        "profileRef": enrollment.profile_ref,
        "hostSha256": receipt.host_sha256,
    }));
}

fn doctor() {
    verify();
}

fn uninstall() {
    for directory in chrome_manifest_dirs() {
        let _ = fs::remove_file(directory.join(format!("{HOST_NAME}.json")));
    }
    let _ = fs::remove_file(connection_config_path());
    let _ = fs::remove_file(activation_receipt_path());
    let _ = fs::remove_dir_all(grass_eye_root().join("browser-runtime").join("releases").join(RELEASE_IDENTITY));
    println!("{}", serde_json::json!({
        "status": "UNINSTALLED",
        "releaseIdentity": RELEASE_IDENTITY,
        "extensionId": EXTENSION_ID,
    }));
}

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.iter().any(|arg| arg == "--enroll-profile") {
        enroll_profile();
    } else if args.iter().any(|arg| arg == "--repair") {
        install();
    } else if args.iter().any(|arg| arg == "--doctor") {
        doctor();
    } else if args.iter().any(|arg| arg == "--uninstall") {
        uninstall();
    } else if args.iter().any(|arg| arg == "--verify") {
        verify();
    } else {
        install();
    }
}
