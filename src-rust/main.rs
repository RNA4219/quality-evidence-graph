fn main() -> std::process::ExitCode {
    match quality_evidence_graph::cli::run(std::env::args().skip(1).collect()) {
        Ok(code) => std::process::ExitCode::from(code as u8),
        Err(error) => {
            eprintln!("Command failure: {error:#}");
            std::process::ExitCode::FAILURE
        }
    }
}
