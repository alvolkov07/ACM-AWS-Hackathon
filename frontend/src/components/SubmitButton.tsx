type Props = {
  busy: boolean;
  /** Label while idle, e.g. "Log in". */
  children: React.ReactNode;
  /** Label while working, e.g. "Logging in…". */
  busyLabel: string;
  className?: string;
  type?: "submit" | "button";
  onClick?: () => void;
  disabled?: boolean;
  /** Show the wheat sprig after the label. */
  sprig?: boolean;
};

/** Pill button that swaps to a spinner and a "working" label while a request runs. */
export default function SubmitButton({
  busy,
  children,
  busyLabel,
  className = "btn btn-solid btn-green",
  type = "submit",
  onClick,
  disabled,
  sprig = false,
}: Props) {
  return (
    <button type={type} onClick={onClick} disabled={busy || disabled} aria-busy={busy} className={className}>
      {busy ? (
        <>
          <span className="spinner" aria-hidden />
          {busyLabel}
        </>
      ) : (
        <>
          {children}
          {sprig && <span aria-hidden className="sprig btn__sprig" />}
        </>
      )}
    </button>
  );
}
