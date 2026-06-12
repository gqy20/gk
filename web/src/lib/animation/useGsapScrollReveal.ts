"use client";

import { useEffect, type RefObject } from "react";
import { gsap, prefersReducedMotion, registerScrollTrigger } from "./gsap";

interface ScrollRevealOptions {
  selector?: string;
  start?: string;
  end?: string;
}

export function useGsapScrollReveal(
  rootRef: RefObject<HTMLElement | null>,
  deps: ReadonlyArray<unknown> = [],
  {
    selector = "[data-scroll-reveal]",
    start = "top 86%",
    end = "top 64%",
  }: ScrollRevealOptions = {},
) {
  useEffect(() => {
    const root = rootRef.current;
    const ScrollTrigger = registerScrollTrigger();
    if (!root || !ScrollTrigger || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      const items = gsap.utils.toArray<HTMLElement>(selector);

      items.forEach((item) => {
        const scrub = item.dataset.scrollScrub === "true";
        const y = Number(item.dataset.scrollY ?? 18);
        const delay = Number(item.dataset.scrollDelay ?? 0);
        const targetOpacity = Number(item.dataset.scrollOpacity ?? 1);

        gsap.fromTo(
          item,
          {
            autoAlpha: 0,
            y,
            filter: "blur(6px)",
          },
          {
            autoAlpha: targetOpacity,
            y: 0,
            filter: "blur(0px)",
            duration: scrub ? 1 : 0.48,
            delay,
            ease: "power4.out",
            clearProps: "filter",
            scrollTrigger: {
              trigger: item,
              start,
              end,
              scrub: scrub ? 0.6 : false,
              once: !scrub,
            },
          },
        );
      });

      ScrollTrigger.refresh();
    }, root);

    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
