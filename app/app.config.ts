export default defineAppConfig({
  ui: {
    colors: {
      primary: "cyan",
      neutral: "slate",
      success: "green",
      warning: "amber",
      error: "red",
    },
    button: {
      slots: {
        base: "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
      },
      defaultVariants: { size: "md" },
    },
    input: {
      slots: {
        base: "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
      },
      defaultVariants: { size: "md" },
    },
    select: {
      slots: {
        base: "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
      },
      defaultVariants: { size: "md" },
    },
    textarea: {
      slots: {
        base: "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
      },
      defaultVariants: { size: "md" },
    },
    accordion: {
      slots: {
        trigger:
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
      },
    },
  },
});
