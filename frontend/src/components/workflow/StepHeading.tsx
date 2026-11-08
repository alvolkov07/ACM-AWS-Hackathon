type Props = {
  n: number;
  title: string;
  hint: string;
  id: string;
  /** Marks the step as finished: the number turns into a check. */
  done?: boolean;
};

export default function StepHeading({ n, title, hint, id, done }: Props) {
  return (
    <div className="mb-4 mt-12 flex items-center gap-3">
      <span
        aria-hidden
        // Body font here: Fogie's "1" reads like a capital "I".
        className={`grid h-10 w-10 flex-none place-items-center rounded-full font-sans text-[17px] font-medium ${
          done ? "bg-leaf text-white" : "bg-field text-white"
        }`}
      >
        {done ? "✓" : n}
      </span>
      <div>
        <h2 id={id} className="font-display text-[24px] leading-tight">
          <span className="sr-only">Step {n}: </span>
          {title}
        </h2>
        <p className="text-[14px] text-muted">{hint}</p>
      </div>
    </div>
  );
}
