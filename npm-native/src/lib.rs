use napi::bindgen_prelude::{AsyncTask, Function};
use napi::{Env, Error, Result, Task};
use napi_derive::napi;
use quality_evidence_graph::cli::{dispatch_api, publish_api_with};
use std::panic::catch_unwind;

fn js_error(error: impl std::fmt::Display) -> Error {
    Error::from_reason(format!("{error:#}"))
}

#[napi(catch_unwind)]
pub fn invoke(method: String, args_json: String) -> Result<String> {
    call(&method, &args_json)
}

fn call(method: &str, args_json: &str) -> Result<String> {
    let args = serde_json::from_str(args_json).map_err(js_error)?;
    let result = dispatch_api(method, &args).map_err(js_error)?;
    serde_json::to_string(&result).map_err(js_error)
}

pub struct ApiTask {
    method: String,
    args_json: String,
}

impl Task for ApiTask {
    type Output = String;
    type JsValue = String;

    fn compute(&mut self) -> Result<String> {
        // libuvのワーカーでもpanicをPromiseの拒否に変換する。
        catch_unwind(|| call(&self.method, &self.args_json))
            .map_err(|_| Error::from_reason("Rust API operation panicked"))?
    }

    fn resolve(&mut self, _env: Env, output: String) -> Result<String> {
        Ok(output)
    }
}

#[napi]
pub fn invoke_async(method: String, args_json: String) -> AsyncTask<ApiTask> {
    AsyncTask::new(ApiTask { method, args_json })
}

#[napi(catch_unwind)]
pub fn publish_with_boundaries(args_json: String, callback: Function<String, ()>) -> Result<()> {
    let args = serde_json::from_str(&args_json).map_err(js_error)?;
    publish_api_with(&args, |boundary| {
        callback
            .call(boundary.to_owned())
            .map_err(|error| anyhow::anyhow!("{error}"))
    })
    .map_err(js_error)
}
