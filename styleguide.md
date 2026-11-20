# Styleguide

## Current UI direction

The homepage extends the visual language already present in the case studies.
The case study documents remain the source of truth for their own design.

1. Audience: readers browsing real business uses of Lyzr AI need a clear index of the existing stories.
2. Tone: restrained editorial, with short labels and strong reading order so readers can quickly choose a story.
3. Palette: use the existing warm off-white, charcoal, gray rules, and orange brand accent; these extend Paper & Ink with the repository's established brand colors.
4. Typography: preserve the existing Aeonik/Inter stack at weights 400 and 500, paired with JetBrains Mono for category labels and numbering, rather than introducing another font family.
5. Layout: a compact two-column introduction followed by a single-column story list, capped at 1240px including gutters; collapse the introduction on phones.
6. Details: generous heading spacing, 1px separators, a 4px brand mark, no shadows, orange arrows, visible keyboard focus, and subtle hover transitions that respect reduced motion.
7. Style name: Lyzr Editorial.

Homepage colors use semantic CSS variables in HSL. Story titles and links come from the existing HTML files. No image assets, build process, or JavaScript are needed for the index.
