use std::process::Command;

#[test]
fn doctor_reports_absent_without_claiming_activation() {
    let output = Command::new(env!("CARGO_BIN_EXE_grasseye-browserctl"))
        .arg("doctor")
        .output()
        .expect("browserctl runs");
    assert!(output.status.success());
    assert!(String::from_utf8_lossy(&output.stdout).contains("ABSENT_NOT_ACTIVATABLE"));
}

#[test]
fn activation_fails_closed_without_signed_tuple() {
    let output = Command::new(env!("CARGO_BIN_EXE_grasseye-browserctl"))
        .arg("activate")
        .output()
        .expect("browserctl runs");
    assert!(!output.status.success());
    assert!(String::from_utf8_lossy(&output.stderr).contains("BROWSER_ACTIVATION_TUPLE_INVALID"));
}
