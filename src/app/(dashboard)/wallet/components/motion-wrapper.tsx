"use client"

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface FadeInProps {
    children: ReactNode;
    className?: string;
    delay?: number;
    direction?: "up" | "down" | "left" | "right";
    duration?: number;
    fullWidth?: boolean;
}

export function FadeIn({
    children,
    className,
    delay = 0,
    direction = "up",
    duration = 0.5,
    fullWidth = true
}: FadeInProps) {
    const variants = {
        hidden: {
            opacity: 0,
            y: direction === "up" ? 40 : direction === "down" ? -40 : 0,
            x: direction === "left" ? 40 : direction === "right" ? -40 : 0,
        },
        visible: {
            opacity: 1,
            y: 0,
            x: 0,
            transition: {
                duration: duration,
                ease: [0.25, 0.1, 0.25, 1.0] as [number, number, number, number], // cubic-bezier for smooth "premium" feel
                delay: delay,
            },
        },
    };

    return (
        <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }} // Trigger slightly before element is fully in view
            variants={variants}
            className={cn(fullWidth ? "w-full" : "", className)}
        >
            {children}
        </motion.div>
    );
}
