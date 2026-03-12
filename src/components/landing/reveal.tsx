'use client'

import { motion } from 'framer-motion'

import { cn } from '@/lib/utils'

type RevealProps = {
  children: React.ReactNode
  className?: string
  delayMs?: number
}

export default function Reveal({ children, className, delayMs = 0 }: RevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.985 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{
        duration: 0.7,
        ease: [0.22, 1, 0.36, 1],
        delay: delayMs / 1000,
      }}
      className={cn(
        'motion-reduce:transform-none motion-reduce:transition-none will-change-transform',
        className
      )}
    >
      {children}
    </motion.div>
  )
}
