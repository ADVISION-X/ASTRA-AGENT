use serde::Deserialize;
use serde_json::Value;
use std::env;
use std::fs;
use std::io::{self, BufRead, BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{self, Command};
use std::thread;

#[cfg(unix)]
use std::os::unix::fs::MetadataExt;
#[cfg(unix)]
use std::os::unix::net::UnixStream;

const PROTOCOL_VERSION: &str = "grasseye-browser-v2";
const RELEASE_IDENTITY: &str = "grasseye-browser-runtime-2026-08-18-v2";
const EXTENSION_ID: &str = "mepfnlhndaiihhfejbbhfehegpbdnipl";
const EXPECTED_ORIGIN: &str = "chrome-extension://mepfnlhndaiihhfejbbhfehegpbdnipl/";
const EXTENSION_TO_HOST_MAX_BYTES: usize = 48 * 1024 * 1024;
const HOST_TO_EXTENSION_MAX_BYTES: usize = 256 * 1024;
const CONTROLLER_LINE_MAX_BYTES: usize = 64 * 1024 * 1024;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HostConfig {
    protocol_version: String,
    release_identity: String,
    extension_id: String,
    socket_path: String,
    profile_ref: String,
    user_data_dir: String,
    profile_directory: String,
    chrome_executable_path: String,
}

fn fail(code: &str, detail: impl AsRef<str>) -> ! {
    eprintln!(
        "{}",
        serde_json::json!({ "code": code, "reason": detail.as_ref() })
    );
    process::exit(1);
}

fn config_path() -> PathBuf {
    if let Ok(value) = env::var("GRASSEYE_BROWSER_NATIVE_CONFIG") {
        if !value.trim().is_empty() {
            return PathBuf::from(value);
        }
    }
    let home = env::var_os("HOME").unwrap_or_else(|| fail("BROWSER_HOST_HOME_MISSING", "HOME is not set"));
    #[cfg(target_os = "macos")]
    {
        return PathBuf::from(home)
            .join("Library")
            .join("Application Support")
            .join("GrassEye")
            .join("browser-native-host.json");
    }
    #[cfg(target_os = "linux")]
    {
        return PathBuf::from(home)
            .join(".config")
            .join("grasseye")
            .join("browser-native-host.json");
    }
    #[allow(unreachable_code)]
    PathBuf::from(home).join(".grasseye").join("browser-native-host.json")
}

#[cfg(unix)]
fn assert_owner_only(path: &Path, expected_file: bool) {
    let metadata = fs::metadata(path)
        .unwrap_or_else(|error| fail("BROWSER_HOST_METADATA_FAILED", format!("{}: {error}", path.display())));
    if expected_file && !metadata.is_file() {
        fail("BROWSER_HOST_FILE_REQUIRED", path.display().to_string());
    }
    if metadata.mode() & 0o077 != 0 {
        fail("BROWSER_HOST_PERMISSION_MISMATCH", path.display().to_string());
    }
    let effective_uid = unsafe { libc::geteuid() };
    if metadata.uid() != effective_uid {
        fail("BROWSER_HOST_OWNER_MISMATCH", path.display().to_string());
    }
}

fn load_config() -> HostConfig {
    let path = config_path();
    #[cfg(unix)]
    assert_owner_only(&path, true);
    let bytes = fs::read(&path)
        .unwrap_or_else(|error| fail("BROWSER_HOST_CONFIG_READ_FAILED", format!("{}: {error}", path.display())));
    let config: HostConfig = serde_json::from_slice(&bytes)
        .unwrap_or_else(|error| fail("BROWSER_HOST_CONFIG_INVALID", error.to_string()));
    if config.protocol_version != PROTOCOL_VERSION {
        fail("BROWSER_HOST_PROTOCOL_MISMATCH", config.protocol_version);
    }
    if config.release_identity != RELEASE_IDENTITY {
        fail("BROWSER_HOST_RELEASE_MISMATCH", config.release_identity);
    }
    if config.extension_id != EXTENSION_ID {
        fail("BROWSER_HOST_EXTENSION_ID_MISMATCH", config.extension_id);
    }
    if config.profile_ref.trim().is_empty() || config.profile_directory.trim().is_empty() {
        fail("BROWSER_HOST_PROFILE_ENROLLMENT_INVALID", "profileRef/profileDirectory missing");
    }
    for candidate in [&config.socket_path, &config.user_data_dir, &config.chrome_executable_path] {
        if !Path::new(candidate).is_absolute() {
            fail("BROWSER_HOST_ABSOLUTE_PATH_REQUIRED", candidate);
        }
    }
    config
}

fn assert_caller_origin() {
    let origin = env::args().nth(1).unwrap_or_else(|| fail("BROWSER_HOST_CALLER_ORIGIN_MISSING", "Chrome did not provide extension origin"));
    if origin != EXPECTED_ORIGIN {
        fail("BROWSER_HOST_CALLER_ORIGIN_MISMATCH", origin);
    }
}

#[cfg(unix)]
fn read_process_identity(pid: i32) -> Option<(i32, String)> {
    let output = Command::new("/bin/ps")
        .args(["-p", &pid.to_string(), "-o", "ppid=", "-o", "command="])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8(output.stdout).ok()?;
    let line = text.trim();
    let mut parts = line.splitn(2, char::is_whitespace);
    let parent = parts.next()?.trim().parse::<i32>().ok()?;
    let command = parts.next()?.trim().to_string();
    Some((parent, command))
}

#[cfg(unix)]
fn assert_enrolled_browser_ancestry(config: &HostConfig) {
    let expected_user_data = format!("--user-data-dir={}", config.user_data_dir);
    let expected_profile = format!("--profile-directory={}", config.profile_directory);
    let mut pid = unsafe { libc::getppid() };
    for _ in 0..8 {
        if pid <= 1 {
            break;
        }
        let Some((parent, command)) = read_process_identity(pid) else {
            break;
        };
        if command.contains(&config.chrome_executable_path)
            && command.contains(&expected_user_data)
            && command.contains(&expected_profile)
        {
            return;
        }
        pid = parent;
    }
    fail(
        "BROWSER_HOST_PROFILE_PROCESS_ATTESTATION_FAILED",
        format!(
            "Native Host caller is not descended from enrolled Chrome process for profile {}",
            config.profile_ref
        ),
    );
}

fn validate_message_identity(bytes: &[u8]) {
    let value: Value = serde_json::from_slice(bytes)
        .unwrap_or_else(|error| fail("BROWSER_HOST_JSON_INVALID", error.to_string()));
    let object = value.as_object().unwrap_or_else(|| fail("BROWSER_HOST_MESSAGE_INVALID", "message must be a JSON object"));
    if object.get("protocolVersion").and_then(Value::as_str) != Some(PROTOCOL_VERSION) {
        fail("BROWSER_HOST_MESSAGE_PROTOCOL_MISMATCH", "message protocolVersion mismatch");
    }
    if object.get("releaseIdentity").and_then(Value::as_str) != Some(RELEASE_IDENTITY) {
        fail("BROWSER_HOST_MESSAGE_RELEASE_MISMATCH", "message releaseIdentity mismatch");
    }
}

fn read_native_message(reader: &mut impl Read) -> io::Result<Option<Vec<u8>>> {
    let mut header = [0_u8; 4];
    let mut read = 0_usize;
    while read < header.len() {
        let count = reader.read(&mut header[read..])?;
        if count == 0 {
            if read == 0 {
                return Ok(None);
            }
            return Err(io::Error::new(io::ErrorKind::UnexpectedEof, "truncated native message header"));
        }
        read += count;
    }
    let size = u32::from_ne_bytes(header) as usize;
    if size == 0 || size > EXTENSION_TO_HOST_MAX_BYTES {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "native request exceeds bounded size"));
    }
    let mut body = vec![0_u8; size];
    reader.read_exact(&mut body)?;
    Ok(Some(body))
}

fn write_native_message(writer: &mut impl Write, bytes: &[u8]) -> io::Result<()> {
    if bytes.is_empty() || bytes.len() > HOST_TO_EXTENSION_MAX_BYTES {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "native response exceeds bounded size"));
    }
    let size = u32::try_from(bytes.len())
        .map_err(|_| io::Error::new(io::ErrorKind::InvalidData, "native response length overflow"))?;
    writer.write_all(&size.to_ne_bytes())?;
    writer.write_all(bytes)?;
    writer.flush()
}

#[cfg(unix)]
fn run(config: HostConfig) -> io::Result<()> {
    assert_enrolled_browser_ancestry(&config);
    let socket_path = Path::new(&config.socket_path);
    assert_owner_only(socket_path, false);
    let stream = UnixStream::connect(socket_path)?;
    let mut request_stream = stream.try_clone()?;
    let response_stream = stream;

    let request_thread = thread::spawn(move || -> io::Result<()> {
        let stdin = io::stdin();
        let mut stdin = stdin.lock();
        loop {
            let Some(body) = read_native_message(&mut stdin)? else {
                request_stream.shutdown(std::net::Shutdown::Write)?;
                return Ok(());
            };
            validate_message_identity(&body);
            request_stream.write_all(&body)?;
            request_stream.write_all(b"\n")?;
            request_stream.flush()?;
        }
    });

    let stdout = io::stdout();
    let mut stdout = stdout.lock();
    let mut reader = BufReader::new(response_stream);
    let mut line = Vec::new();
    loop {
        line.clear();
        let count = reader.read_until(b'\n', &mut line)?;
        if count == 0 {
            break;
        }
        if line.len() > CONTROLLER_LINE_MAX_BYTES {
            return Err(io::Error::new(io::ErrorKind::InvalidData, "controller response exceeds bounded size"));
        }
        if line.last() == Some(&b'\n') {
            line.pop();
        }
        if line.is_empty() {
            continue;
        }
        validate_message_identity(&line);
        write_native_message(&mut stdout, &line)?;
    }

    match request_thread.join() {
        Ok(result) => result,
        Err(_) => Err(io::Error::new(io::ErrorKind::Other, "native request thread panicked")),
    }
}

#[cfg(not(unix))]
fn run(_config: HostConfig) -> io::Result<()> {
    Err(io::Error::new(
        io::ErrorKind::Unsupported,
        "this release supports the owner-only Unix controller channel on macOS/Linux",
    ))
}

fn main() {
    assert_caller_origin();
    let config = load_config();
    if let Err(error) = run(config) {
        fail("BROWSER_NATIVE_HOST_FAILED", error.to_string());
    }
}
