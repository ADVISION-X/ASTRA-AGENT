use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::env;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process;
use std::time::{SystemTime, UNIX_EPOCH};

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

const PROTOCOL_VERSION: &str = "grasseye-browser-v2";
const RELEASE_IDENTITY: &str = "grasseye-browser-runtime-2026-08-18-v2";
const EXTENSION_ID: &str = "mepfnlhndaiihhfejbbhfehegpbdnipl";
const HOST_NAME: &str = "com.grasseye.browser";
const HOST_BINARY_NAME: &str = "grasseye-browser-host";

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
    protocol_version: String,
    extension_id: String,
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

fn resolve_source_host() -> PathBuf {
    if let Ok(value) = env::var("GRASSEYE_BROWSER_HOST_BINARY") {
        let path = PathBuf::from(value);
        if path.is_file() {
            return path;
        }
        fail("BROWSERCTL_HOST_BINARY_MISSING", path.display().to_string());
    }
    let executable = env::current_exe()
        .unwrap_or_else(|error| fail("BROWSERCTL_CURRENT_EXE_FAILED", error.to_string()));
    let sibling = executable.parent().unwrap().join(HOST_BINARY_NAME);
    if !sibling.is_file() {
        fail("BROWSERCTL_HOST_BINARY_MISSING", sibling.display().to_string());
    }
    sibling
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

fn installed_host_path() -> PathBuf {
    grass_eye_root()
        .join("browser-runtime")
        .join("releases")
        .join(RELEASE_IDENTITY)
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
    let source_host = resolve_source_host();
    let source_hash = sha256_file(&source_host);
    let host_path = installed_host_path();
    let host_bytes = fs::read(&source_host)
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
        release_identity: RELEASE_IDENTITY.to_string(),
        protocol_version: PROTOCOL_VERSION.to_string(),
        extension_id: EXTENSION_ID.to_string(),
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
        "extensionId": EXTENSION_ID,
        "profileRef": receipt.profile_ref,
        "hostPath": host_path,
        "hostSha256": source_hash,
        "socketPath": socket_path,
    }));
}

fn verify() {
    let enrollment = enrolled_profile_fields();
    let host_path = installed_host_path();
    if !host_path.is_file() {
        fail("BROWSERCTL_HOST_NOT_INSTALLED", host_path.display().to_string());
    }
    let receipt_bytes = fs::read(activation_receipt_path())
        .unwrap_or_else(|error| fail("BROWSERCTL_ACTIVATION_READ_FAILED", error.to_string()));
    let receipt: ActivationReceipt = serde_json::from_slice(&receipt_bytes)
        .unwrap_or_else(|error| fail("BROWSERCTL_ACTIVATION_INVALID", error.to_string()));
    if receipt.schema_version != "grasseye-browser-activation-v2"
        || receipt.release_identity != RELEASE_IDENTITY
        || receipt.protocol_version != PROTOCOL_VERSION
        || receipt.extension_id != EXTENSION_ID
        || receipt.profile_enrollment_id != enrollment.profile_enrollment_id
        || receipt.host_path != host_path.to_string_lossy()
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
