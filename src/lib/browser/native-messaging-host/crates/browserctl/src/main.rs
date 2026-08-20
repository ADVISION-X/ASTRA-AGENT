mod activate;
mod doctor;
mod enroll_profile;
mod install;
mod repair;
mod rollback;
mod verify;

fn main() {
    let command = std::env::args().nth(1).unwrap_or_else(|| "doctor".to_owned());
    let result = match command.as_str() {
        "install" => install::run(),
        "verify" => verify::run(),
        "doctor" => doctor::run(),
        "repair" => repair::run(),
        "enroll-profile" => enroll_profile::run(),
        "activate" => activate::run(),
        "rollback" => rollback::run(),
        _ => Err("BROWSER_COMMAND_PERMIT_INVALID"),
    };
    match result {
        Ok(message) => println!("{message}"),
        Err(code) => { eprintln!("{code}"); std::process::exit(2); }
    }
}
