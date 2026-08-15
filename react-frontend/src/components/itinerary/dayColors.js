// Per-day marker color, one distinct hue per DayNumber up to the 14-day max
// trip length (Node/Services/itineraryPlanner.js's safeDuration cap), used by
// Itinerary.js to badge each spot marker by which day it belongs to.
//
// Chosen by a farthest-point search + local-swap refinement over the OKLCH
// gamut, maximizing the *worst* pairwise OKLab distance across all 91
// day-pairs (not just neighbors) —
// every marker can sit next to every other on the same map at once, so
// "adjacent in the list" separation isn't enough; every pair needs to read
// apart. Verified against the dataviz skill's validate_palette.js
// (`--pairs all`): worst-case pair ΔE 16.9 (OKLab ×100, normal vision) —
// clears the skill's 15-point "hard to tell apart" floor for every pair, and
// every color keeps >=3:1 WCAG contrast against white so the badge's white
// visit-order number and white halo border both stay legible on top of it.
//
// What this palette does NOT guarantee: colorblind-safe separation for every
// pair. The skill's own reference 8-color palette can only clear that bar
// for its first 3 slots under all-pairs comparison — 14 categories is well
// past what any hue-only palette can keep CVD-safe pairwise. Accordingly,
// nothing here depends on color alone: dayColors.test.js pins the achieved
// normal-vision floor as a regression guard, and Itinerary.js backs color
// with non-color identity — the badge's visit-order number, each day's
// geographic spot clustering (itineraryPlanner.js), and a "Day N · Stop M"
// text label in the marker's InfoWindow on click.
export const DAY_COLORS = [
  '#ab0751', '#0f1eb9', '#1da90f', '#0068f8', '#00580d', '#8b2dce', '#5e2273',
  '#e9389f', '#590000', '#001a59', '#806e1c', '#977cc5', '#1d9998', '#dc5426'
];

export function dayColor(dayNumber) {
  return DAY_COLORS[(dayNumber - 1) % DAY_COLORS.length];
}
