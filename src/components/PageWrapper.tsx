import { motion } from 'framer-motion';
import React from 'react';

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  in: { opacity: 1, y: 0 },
  out: { opacity: 0, y: -20 },
};

const pageTransition = {
  type: 'spring',
  stiffness: 100,
  damping: 20,
};

const PageWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <motion.div
    initial="initial"
    animate="in"
    exit="out"
    variants={pageVariants}
    transition={pageTransition}
    style={{ minHeight: '80vh' }}
  >
    {children}
  </motion.div>
);

export default PageWrapper; 