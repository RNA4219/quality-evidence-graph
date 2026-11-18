//! I/O境界を観測するプロセス内フック。通常のCLIは観測者を登録しない。
use std::{cell::RefCell, io, path::Path, rc::Rc};

type Observer = Rc<dyn Fn(&str, &Path) -> io::Result<()>>;
thread_local! { static OBSERVER: RefCell<Option<Observer>> = const { RefCell::new(None) }; }

pub(crate) fn event(operation: &str, path: &Path) -> io::Result<()> {
    OBSERVER.with_borrow(|observer| match observer {
        Some(observer) => observer(operation, path),
        None => Ok(()),
    })
}

/// 指定したスレッドと操作の範囲で観測する。終了時とunwind時に以前の設定へ戻す。
#[doc(hidden)]
pub fn observe<T>(
    observer: impl Fn(&str, &Path) -> io::Result<()> + 'static,
    run: impl FnOnce() -> T,
) -> T {
    struct Guard(Option<Observer>);
    impl Drop for Guard {
        fn drop(&mut self) {
            OBSERVER.set(self.0.take());
        }
    }
    let _guard = Guard(OBSERVER.replace(Some(Rc::new(observer))));
    run()
}
