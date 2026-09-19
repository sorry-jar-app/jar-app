/** The 46x27 track and its knob. Presentational — the row owns the button. */
export function Toggle({ on }: { on: boolean }) {
  return (
    <span className="sj-track" data-on={on} aria-hidden="true">
      <span className="sj-knob" />
    </span>
  );
}
