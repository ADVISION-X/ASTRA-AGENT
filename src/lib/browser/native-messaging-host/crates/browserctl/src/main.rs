use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::env;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process;

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
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ActivationReceipt {
    schema_version: String,
    release_identity: String,
    protocol_version: String,
    extension_id: String,
    host_path: String,
    host_sha256: String,
    controller_socket_path: String,
    activated_at: String,
}

fn fail(code: &str, detail: impl AsRef<str>) -> ! {
    eprintln!("{}", serde_json::json!({ "status": "BLOCKED", "code": code, "reason": detail.as_ref() }));
    process::exit(1);
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

fn write_atomic(path: &Path, bytes: &[u8], mode: u32) {
    let parent = path.parent().unwrap_or_else(|| fail("BROWSERCTL_PATH_INVALID", path.display().to_string()));
    fs::create_dir_all(parent)
        .unwrap_or_else(|error| fail("BROWSERCTL_MKDIR_FAILED", format!("{}: {error}", parent.display())));
    let temp = parent.join(format!(".{}.tmp-{}", path.file_name().unwrap().to_string_lossy(), process::id()));
    let mut options = OpenOptions::new();
    options.create_new(true).write(true);
    let mut file = options.open(&temp)
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

fn native_manifest_json(host_path: &Path) -> Vec<u8> {
    serde_json::to_vec_pretty(&serde_json::json!({
        "name": HOST_NAME,
        "description": "GrassEye authenticated browser runtime",
        "path": host_path.to_string_lossy(),
        "type": "stdio",
        "allowed_origins": [format!("chrome-extension://{EXTENSION_ID}/")]
    })).unwrap()
}

fn install() {
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

    let receipt = ActivationReceipt {
        schema_version: "grasseye-browser-activation-v1".to_string(),
        release_identity: RELEASE_IDENTITY.to_string(),
        protocol_version: PROTOCOL_VERSION.to_string(),
        extension_id: EXTENSION_ID.to_string(),
        host_path: host_path.to_string_lossy().to_string(),
        host_sha256: source_hash.clone(),
        controller_socket_path: socket_path.to_string_lossy().to_string(),
        activated_at: "generated-by-browserctl".to_string(),
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
        "hostPath": host_path,
        "hostSha256": source_hash,
        "socketPath": socket_path,
    }));
}

fn verify() {
    let host_path = installed_host_path();
    if !host_path.is_file() {
        fail("BROWSERCTL_HOST_NOT_INSTALLED", host_path.display().to_string());
    }
    let receipt_bytes = fs::read(activation_receipt_path())
        .unwrap_or_else(|error| fail("BROWSERCTL_ACTIVATION_READ_FAILED", error.to_string()));
    let receipt: ActivationReceipt = serde_json::from_slice(&receipt_bytes)
        .unwrap_or_else(|error| fail("BROWSERCTL_ACTIVATION_INVALID", error.to_string()));
    if receipt.release_identity != RELEASE_IDENTITY
        || receipt.protocol_version != PROTOCOL_VERSION
        || receipt.extension_id != EXTENSION_ID
        || receipt.host_path != host_path.to_string_lossy()
        || receipt.host_sha256 != sha256_file(&host_path)
    {
        fail("BROWSERCTL_ACTIVATION_MISMATCH", "activation receipt does not match installed host");
    }
    let config_bytes = fs::read(connection_config_path())
        .unwrap_or_else(|error| fail("BROWSERCTL_CONFIG_READ_FAILED", error.to_string()));
    let config: HostConnectionConfig = serde_json::from_slice(&config_bytes)
        .unwrap_or_else(|error| fail("BROWSERCTL_CONFIG_INVALID", error.to_string()));
    if config.protocol_version != PROTOCOL_VERSION
        || config.release_identity != RELEASE_IDENTITY
        || config.extension_id != EXTENSION_ID
        || !Path::new(&config.socket_path).is_absolute()
    {
        fail("BROWSERCTL_CONFIG_MISMATCH", "connection config does not match release identity");
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
        "hostSha256": receipt.host_sha256,
    }));
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
    if args.iter().any(|arg| arg == "--uninstall") {
        uninstall();
    } else if args.iter().any(|arg| arg == "--verify") {
        verify();
    } else {
        install();
    }
}
