import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Zap, Star, X } from 'lucide-react';

interface LevelUpOverlayProps {
  isOpen: boolean;
  level: number;
  rewards: string[];
  onClose: () => void;
  triggerParticles: () => void;
}

export function LevelUpOverlay({
  isOpen,
  level,
  rewards,
  onClose,
  triggerParticles,
}: LevelUpOverlayProps) {
  useEffect(() => {
    if (isOpen) {
      // Trigger multiple bursts across the viewport to paint the screen with celebration
      const w = window.innerWidth;
      const h = window.innerHeight;
      
      const bursts = [
        { x: w * 0.25, y: h * 0.4, type: 'rainbow' },
        { x: w * 0.5, y: h * 0.35, type: 'coins' },
        { x: w * 0.75, y: h * 0.4, type: 'gems' }
      ];

      bursts.forEach((b, i) => {
        setTimeout(() => {
          if ((window as any).triggerCelebration) {
            (window as any).triggerCelebration(b.x, b.y, b.type);
          }
        }, i * 200);
      });
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
          {/* Glassmorphic Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-[color:var(--os-bg)]/85 backdrop-blur-md cursor-pointer"
          />

          {/* Celebration Modal */}
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 15 }}
            transition={{ type: 'spring', damping: 20, stiffness: 220 }}
            className="relative bg-[color:var(--os-s1)] border border-white/10 rounded-3xl p-8 max-w-sm w-full shadow-[0_0_60px_rgba(0, 230, 150,0.25)] overflow-hidden text-center flex flex-col items-center gap-6"
            style={{ boxSizing: 'border-box' }}
          >
            {/* Glowing radial background flare */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#30ff44] rounded-full blur-[80px] opacity-15 pointer-events-none" />

            {/* Exit Icon */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              style={{ border: '1px solid rgb(var(--os-fg-rgb) / 0.1)', background: 'transparent' }}
            >
              <X size={15} />
            </button>

            {/* Spinning Level Crest */}
            <div className="relative mt-3">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0 w-24 h-24 border border-dashed border-[#7dffc4]/25 rounded-full scale-110 pointer-events-none"
                style={{ top: 0, left: 0 }}
              />
              <motion.div
                initial={{ scale: 0, rotate: -60 }}
                animate={{ scale: [0, 1.2, 1], rotate: 0 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 180 }}
                className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#30ff44] to-[#00ffc2] flex items-center justify-center text-black border-4 border-[color:var(--os-s1)] shadow-[0_0_24px_rgba(0, 230, 150,0.45)]"
              >
                <Trophy size={44} className="drop-shadow-md text-white" />
              </motion.div>
            </div>

            {/* Header Titles */}
            <div className="flex flex-col gap-1.5 relative z-10">
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="text-2xl font-black tracking-tight text-white m-0"
              >
                НОВЫЙ УРОВЕНЬ!
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="text-[#7dffc4] font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 m-0"
              >
                <Zap size={13} className="fill-current text-[#7dffc4]" /> Вы достигли {level} уровня
              </motion.p>
            </div>

            {/* Rewards Cards list */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45 }}
              className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col gap-2.5"
              style={{ boxSizing: 'border-box' }}
            >
              <h3 className="text-left text-[10px] uppercase tracking-wider text-white/40 font-bold flex items-center gap-1.5 m-0">
                <Star size={11} className="text-[#7dffc4] fill-current" /> Разблокировано:
              </h3>
              <div className="flex flex-col gap-2">
                {rewards.map((reward, idx) => (
                  <motion.div
                    key={reward}
                    initial={{ x: -12, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.55 + idx * 0.1 }}
                    className="flex items-center gap-2 text-xs text-[color:var(--os-fg)] text-left py-0.5"
                  >
                    <span className="w-1.5 h-1.5 bg-[#7dffc4] rounded-full shadow-[0_0_6px_#7dffc4] flex-shrink-0" />
                    <span>{reward}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Resume Call-to-action */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.75 }}
              onClick={onClose}
              className="w-full py-3 bg-gradient-to-r from-[#30ff44] to-[#00ffc2] hover:brightness-110 text-black text-sm font-bold rounded-2xl shadow-[0_4px_16px_rgba(0, 230, 150,0.3)] transition-all cursor-pointer select-none active:scale-[0.98] border-none"
            >
              Продолжить обучение
            </motion.button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
