/*
 * Avatar — style guide §6. Circle, purple→orange gradient, white Fredoka
 * initial. 40px in the top bar, 30px in lists and the header menu.
 *
 * This gradient and the settings toggle are the only two places the
 * purple→orange gradient is allowed (style guide §2, §11) — a rule that is much
 * easier to keep true with exactly one component drawing it.
 */
export function Avatar({
  name,
  size = "nav",
}: {
  name: string;
  /** `nav` = 40px top bar, `list` = 30px lists and menu. */
  size?: "nav" | "list";
}) {
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  const isNav = size === "nav";

  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full font-display font-semibold text-white ${
        isNav ? "size-10 text-[16px]" : "size-[30px] text-[13px]"
      }`}
      style={{
        background: "linear-gradient(135deg, var(--purple), var(--orange))",
      }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}
