'use client';

// NOTE: the upstream component imports from "motion/react". This project already
// ships framer-motion@13 (the same library under its previous name), so we import
// from "framer-motion" rather than installing a second copy of the runtime.
import { motion, type Variants } from 'framer-motion';
import { useState } from 'react';

import { Card, CardContent } from '@/components/ui/card';
import type { Avatar } from '@/lib/avatars';
import { cn } from '@/lib/utils';

export interface AvatarPickerProps {
  /** The set of avatars to choose from. */
  avatars: readonly Avatar[];
  /** Id of the currently selected avatar. */
  selectedId: number;
  /** Called with the newly picked avatar. */
  onSelect: (avatar: Avatar) => void;
  /** Name shown under the large avatar. */
  username: string;
  /** Optional caption under the username. */
  subtitle?: string;
  className?: string;
}

// ─── Animation variants ──────────────────────────────────────────────────────

const mainAvatarVariants: Variants = {
  initial: {
    y: 20,
    opacity: 0,
  },
  animate: {
    y: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 200,
      damping: 20,
    },
  },
  exit: {
    y: -20,
    opacity: 0,
    transition: {
      duration: 0.2,
    },
  },
};

const pickerVariants: { container: Variants; item: Variants } = {
  container: {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  },
  item: {
    initial: {
      y: 20,
      opacity: 0,
    },
    animate: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 20,
      },
    },
  },
};

const selectedVariants: Variants = {
  initial: {
    opacity: 0,
    rotate: -180,
  },
  animate: {
    opacity: 1,
    rotate: 0,
    transition: {
      type: 'spring',
      stiffness: 200,
      damping: 15,
    },
  },
  exit: {
    opacity: 0,
    rotate: 180,
    transition: {
      duration: 0.2,
    },
  },
};

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Controlled avatar picker: one large preview plus a row of selectable
 * thumbnails. Selection state lives in the parent so it can be persisted.
 */
export function AvatarPicker({
  avatars,
  selectedId,
  onSelect,
  username,
  subtitle = 'Select your avatar',
  className,
}: AvatarPickerProps) {
  const [rotationCount, setRotationCount] = useState(0);

  if (avatars.length === 0) return null;

  const selectedAvatar =
    avatars.find((avatar) => avatar.id === selectedId) ?? avatars[0];

  const handleAvatarSelect = (avatar: Avatar) => {
    if (avatar.id === selectedAvatar.id) return;
    setRotationCount((prev) => prev + 1080); // Add 3 rotations each time
    onSelect(avatar);
  };

  return (
    <motion.div initial="initial" animate="animate" className={cn('w-full', className)}>
      <Card className="w-full max-w-md mx-auto overflow-hidden border-border bg-gradient-to-b from-background to-muted/30">
        <CardContent className="p-0">
          {/* Background header */}
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{
              opacity: 1,
              height: '8rem',
              transition: {
                height: {
                  type: 'spring',
                  stiffness: 100,
                  damping: 20,
                },
              },
            }}
            className="bg-gradient-to-r from-primary/20 to-primary/10 w-full"
          />

          <div className="px-8 pb-8 -mt-16">
            {/* Main avatar display */}
            <motion.div
              className="relative w-40 h-40 mx-auto rounded-full overflow-hidden border-4 border-border bg-background flex items-center justify-center"
              variants={mainAvatarVariants}
              layoutId="selectedAvatar"
            >
              <motion.div
                className="w-full h-full flex items-center justify-center"
                animate={{
                  rotate: rotationCount,
                }}
                transition={{
                  duration: 0.8,
                  ease: [0.4, 0, 0.2, 1], // Custom easing for a nice acceleration and deceleration
                }}
              >
                {/*
                  Plain <img> rather than next/image: the source is an inline SVG
                  data URI, so there is nothing for the image optimizer to fetch
                  or resize.
                */}
                <img
                  src={selectedAvatar.src}
                  alt={selectedAvatar.alt}
                  className="w-full h-full object-cover"
                />
              </motion.div>
            </motion.div>

            {/* Username display */}
            <motion.div className="text-center mt-4" variants={pickerVariants.item}>
              <motion.h2
                className="text-2xl font-bold"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                {username}
              </motion.h2>
              <motion.p
                className="text-muted-foreground text-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                {subtitle}
              </motion.p>
            </motion.div>

            {/* Avatar selection */}
            <motion.div className="mt-6" variants={pickerVariants.container}>
              <motion.div
                className="flex flex-wrap justify-center gap-4"
                variants={pickerVariants.container}
                role="radiogroup"
                aria-label="Choose an avatar"
              >
                {avatars.map((avatar) => (
                  <motion.button
                    key={avatar.id}
                    type="button"
                    onClick={() => handleAvatarSelect(avatar)}
                    className={cn(
                      'relative w-12 h-12 rounded-full overflow-hidden border-2 border-border',
                      'transition-all duration-300',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                    )}
                    variants={pickerVariants.item}
                    whileHover={{
                      y: -2,
                      transition: { duration: 0.2 },
                    }}
                    whileTap={{
                      y: 0,
                      transition: { duration: 0.2 },
                    }}
                    aria-label={`Select ${avatar.alt}`}
                    role="radio"
                    aria-checked={selectedAvatar.id === avatar.id}
                  >
                    <div className="w-full h-full flex items-center justify-center">
                      <img
                        src={avatar.src}
                        alt=""
                        aria-hidden="true"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {selectedAvatar.id === avatar.id && (
                      <motion.div
                        className="absolute inset-0 bg-primary/20 ring-2 ring-primary ring-offset-2 ring-offset-background rounded-full"
                        variants={selectedVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        layoutId="selectedIndicator"
                      />
                    )}
                  </motion.button>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
