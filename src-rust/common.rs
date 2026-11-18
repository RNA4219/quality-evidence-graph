use chrono::DateTime;
use regex::Regex;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::sync::LazyLock;

pub fn items(value: &Value) -> &[Value] {
    value.as_array().map(Vec::as_slice).unwrap_or_default()
}

pub fn s(value: &Value) -> &str {
    value.as_str().unwrap_or_default()
}

pub fn digest(bytes: &[u8]) -> String {
    format!("sha256:{:x}", Sha256::digest(bytes))
}

pub fn encode(text: &str) -> String {
    let mut encoded = String::with_capacity(text.len());
    for b in text.bytes() {
        if b.is_ascii_alphanumeric() || b"-_.!~*'()".contains(&b) {
            encoded.push(b as char);
        } else {
            use std::fmt::Write;
            write!(encoded, "%{b:02X}").expect("writing to a string");
        }
    }
    encoded
}

pub fn timestamp_nanos(value: &Value) -> Option<i128> {
    timestamp_str(value.as_str()?)
}

pub fn timestamp_str(text: &str) -> Option<i128> {
    static FORMAT: LazyLock<Regex> = LazyLock::new(|| {
        Regex::new(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-5][0-9](\.[0-9]{1,9})?(Z|[+-][0-9]{2}:[0-9]{2})$").unwrap()
    });
    if !FORMAT.is_match(text) {
        return None;
    }
    let t = DateTime::parse_from_rfc3339(text).ok()?;
    Some(i128::from(t.timestamp()) * 1_000_000_000 + i128::from(t.timestamp_subsec_nanos()))
}

pub fn document(v: &Value) -> anyhow::Result<String> {
    // The wire format is hashed. Preserve JSON.stringify's number spelling,
    // numeric object-key order, indentation and final newline.
    fn render(out: &mut String, value: &Value, depth: usize) -> anyhow::Result<()> {
        fn indent(out: &mut String, depth: usize) {
            out.push('\n');
            for _ in 0..depth {
                out.push_str("  ")
            }
        }
        match value {
            Value::Array(values) => {
                out.push('[');
                for (i, child) in values.iter().enumerate() {
                    if i > 0 {
                        out.push(',')
                    }
                    indent(out, depth + 1);
                    render(out, child, depth + 1)?
                }
                if !values.is_empty() {
                    indent(out, depth)
                }
                out.push(']');
            }
            Value::Object(values) => {
                out.push('{');
                let mut keys: Vec<_> = values.keys().collect();
                keys.sort_by_key(|k| {
                    k.parse::<u32>()
                        .ok()
                        .filter(|n| n.to_string() == **k)
                        .unwrap_or(u32::MAX)
                });
                for (i, k) in keys.into_iter().enumerate() {
                    if i > 0 {
                        out.push(',')
                    }
                    indent(out, depth + 1);
                    out.push_str(&serde_json::to_string(k)?);
                    out.push_str(": ");
                    render(out, &values[k], depth + 1)?
                }
                if !values.is_empty() {
                    indent(out, depth)
                }
                out.push('}');
            }
            Value::Number(n) => out.push_str(
                ryu_js::Buffer::new().format_finite(n.as_f64().expect("JSON finite number")),
            ),
            _ => out.push_str(&serde_json::to_string(value)?),
        }
        Ok(())
    }
    let mut out = String::new();
    render(&mut out, v, 0)?;
    out.push('\n');
    Ok(out)
}
