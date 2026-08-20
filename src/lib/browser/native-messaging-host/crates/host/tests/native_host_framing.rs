use std::io::Cursor;

#[path = "../src/generated/browser_protocol.rs"]
mod browser_protocol;

fn read_frame(reader: &mut Cursor<Vec<u8>>) -> Result<Vec<u8>, &'static str> {
    let mut length = [0u8; 4];
    std::io::Read::read_exact(reader, &mut length).map_err(|_| "BROWSER_HOST_UNAVAILABLE")?;
    let size = u32::from_le_bytes(length) as usize;
    if size > browser_protocol::BROWSER_CONTROL_FRAME_MAX_BYTES { return Err("BROWSER_BACKPRESSURE"); }
    let mut frame = vec![0u8; size];
    std::io::Read::read_exact(reader, &mut frame).map_err(|_| "BROWSER_HOST_UNAVAILABLE")?;
    serde_json::from_slice::<serde_json::Value>(&frame).map_err(|_| "BROWSER_AUTH_TRANSCRIPT_INVALID")?;
    Ok(frame)
}

#[test]
fn native_control_frames_are_length_bounded_and_json_only() {
    let payload = br#"{"kind":"extension-hello"}"#.to_vec();
    let mut bytes = Vec::new();
    bytes.extend_from_slice(&(payload.len() as u32).to_le_bytes());
    bytes.extend_from_slice(&payload);
    assert_eq!(read_frame(&mut Cursor::new(bytes)).unwrap(), payload);
}
