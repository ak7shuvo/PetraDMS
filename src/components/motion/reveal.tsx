"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { ease } from "@/lib/motion";

type Props = HTMLMotionProps<"div"> & { delay?: number; y?: number };

/** Scroll-triggered fade/translate reveal. Reuse for any block. */
export function Reveal({ delay = 0, y = 28, children, ...rest }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.9, ease, delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
