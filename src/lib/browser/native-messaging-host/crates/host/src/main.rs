mod generated { pub mod browser_protocol; }

use std::env;
use std::io::{self, Read, Write};
use std::os::unix::net::UnixStream;
use std::sync::{Arc, Mutex};
use std::thread;

const CONTROLLER_SOCKET_ENV: &str = "GRASSEYE_BROWSER_CONTROLLER_SOCKET";
const BOOTSTRAP_ENV: &str = "GRASSEYE_BROWSER_HOST_BOOTSTRAP";
const PARENT_PID_ENV: &str = "GRASSEYE_BROWSER_CHROME_PARENT_PID";
const PROFILE_HASH_ENV: &str = "GRASSEYE_BROWSER_PROFILE_ENROLLMENT_HASH";
const PROCESS_HASH_ENV: &str = "GRASSEYE_BROWSER_PROCESS_INCARNATION_HASH";

fn read_frame<R: Read>(reader: &mut R) -> io::Result<Option<Vec<u8>>> {
    let mut length_bytes = [0u8; 4];
    match reader.read_exact(&mut length_bytes) {
        Ok(()) => {}
        Err(error) if error.kind() == io::ErrorKind::UnexpectedEof => return Ok(None),
        Err(error) => return Err(error),
    }
    let length = u32::from_le_bytes(length_bytes) as usize;
    if length > generated::browser_protocol::BROWSER_CONTROL_FRAME_MAX_BYTES {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "BROWSER_BACKPRESSURE"));
    }
    let mut frame = vec![0u8; length];
    reader.read_exact(&mut frame)?;
    let _: serde_json::Value = serde_json::from_slice(&frame)
        .map_err(|_| io::Error::new(io::ErrorKind::InvalidData, "BROWSER_AUTH_TRANSCRIPT_INVALID"))?;
    Ok(Some(frame))
}

fn write_frame<W: Write>(writer: &mut W, frame: &[u8]) -> io::Result<()> {
    if frame.len() > generated::browser_protocol::BROWSER_CONTROL_FRAME_MAX_BYTES {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "BROWSER_BACKPRESSURE"));
    }
    let _: serde_json::Value = serde_json::from_slice(frame)
        .map_err(|_| io::Error::new(io::ErrorKind::InvalidData, "BROWSER_AUTH_TRANSCRIPT_INVALID"))?;
    writer.write_all(&(frame.len() as u32).to_le_bytes())?;
    writer.write_all(frame)?;
    writer.flush()
}

fn required_env(name: &str) -> io::Result<String> {
    env::var(name).map_err(|_| io::Error::new(io::ErrorKind::PermissionDenied, "BROWSER_AUTH_TRANSCRIPT_INVALID"))
}

fn validate_host_attestation(bootstrap: &serde_json::Value) -> io::Result<()> {
    let expected_parent = required_env(PARENT_PID_ENV)?
        .parse::<u32>()
        .map_err(|_| io::Error::new(io::ErrorKind::InvalidData, "BROWSER_PROCESS_UNVERIFIED"))?;
    let actual_parent = unsafe { libc::getppid() };
    if actual_parent < 1 || actual_parent as u32 != expected_parent {
        return Err(io::Error::new(io::ErrorKind::PermissionDenied, "BROWSER_PROCESS_UNVERIFIED"));
    }
    let profile_hash = required_env(PROFILE_HASH_ENV)?;
    let process_hash = required_env(PROCESS_HASH_ENV)?;
    let handshake = bootstrap.get("proof")
        .and_then(|proof| proof.get("handshake"))
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "BROWSER_AUTH_TRANSCRIPT_INVALID"))?;
    if handshake.get("profileEnrollmentHash").and_then(serde_json::Value::as_str) != Some(profile_hash.as_str())
        || handshake.get("processIncarnationHash").and_then(serde_json::Value::as_str) != Some(process_hash.as_str()) {
        return Err(io::Error::new(io::ErrorKind::PermissionDenied, "BROWSER_PROFILE_UNVERIFIED"));
    }
    Ok(())
}

fn main() -> io::Result<()> {
    let socket_path = env::var(CONTROLLER_SOCKET_ENV)
        .map_err(|_| io::Error::new(io::ErrorKind::NotConnected, "BROWSER_HOST_UNAVAILABLE"))?;
    let stream = UnixStream::connect(socket_path)
        .map_err(|_| io::Error::new(io::ErrorKind::NotConnected, "BROWSER_HOST_UNAVAILABLE"))?;
    let bootstrap = required_env(BOOTSTRAP_ENV)?;
    let bootstrap_value: serde_json::Value = serde_json::from_str(&bootstrap)
        .map_err(|_| io::Error::new(io::ErrorKind::InvalidData, "BROWSER_AUTH_TRANSCRIPT_INVALID"))?;
    if bootstrap_value.get("kind").and_then(serde_json::Value::as_str) != Some("host-bootstrap") {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "BROWSER_AUTH_TRANSCRIPT_INVALID"));
    }
    validate_host_attestation(&bootstrap_value)?;
    let mut controller_reader = stream.try_clone()?;
    let controller_writer = Arc::new(Mutex::new(stream));
    let native_writer = Arc::new(Mutex::new(io::stdout()));
    {
        let mut writer = native_writer.lock().map_err(|_| io::Error::new(io::ErrorKind::Other, "BROWSER_HOST_UNAVAILABLE"))?;
        write_frame(&mut *writer, bootstrap.as_bytes())?;
    }

    let extension_to_controller = {
        let controller_writer = Arc::clone(&controller_writer);
        thread::spawn(move || -> io::Result<()> {
            let mut native_reader = io::stdin();
            while let Some(frame) = read_frame(&mut native_reader)? {
                let mut writer = controller_writer.lock().map_err(|_| io::Error::new(io::ErrorKind::Other, "BROWSER_HOST_UNAVAILABLE"))?;
                write_frame(&mut *writer, &frame)?;
            }
            Ok(())
        })
    };

    while let Some(frame) = read_frame(&mut controller_reader)? {
        let mut writer = native_writer.lock().map_err(|_| io::Error::new(io::ErrorKind::Other, "BROWSER_HOST_UNAVAILABLE"))?;
        write_frame(&mut *writer, &frame)?;
    }
    let _ = extension_to_controller.join();
    Ok(())
}
