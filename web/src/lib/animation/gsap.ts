import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export { gsap };

let scrollTriggerRegistered = false;

export function registerScrollTrigger() {
  if (typeof window === "undefined" || scrollTriggerRegistered) return null;
  gsap.registerPlugin(ScrollTrigger);
  scrollTriggerRegistered = true;
  return ScrollTrigger;
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
