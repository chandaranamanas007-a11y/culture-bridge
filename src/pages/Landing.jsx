import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Globe, Users } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16 text-center relative overflow-hidden">
      {/* Background animated elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.15, 0.1],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-20 -left-20 w-96 h-96 bg-saffron rounded-full blur-[100px]"
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.5, 1],
            opacity: [0.1, 0.2, 0.1],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute bottom-0 -right-20 w-[30rem] h-[30rem] bg-lagoon rounded-full blur-[120px]"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="max-w-2xl w-full flex flex-col items-center"
      >
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: "spring" }}
          className="bg-surface2 px-4 py-2 rounded-full border border-white/10 mb-8 flex items-center gap-2 shadow-lg"
        >
          <span className="text-xl">🇮🇳</span>
          <span className="font-mono text-xs tracking-[0.3em] text-muted uppercase">
            Interact Beyond Borders
          </span>
          <span className="text-xl">🇲🇺</span>
        </motion.div>

        <h1 className="font-display text-5xl sm:text-7xl font-bold leading-tight mb-4 drop-shadow-xl text-cream">
          Culture Bridge
        </h1>
        <p className="font-display italic text-2xl sm:text-3xl text-saffron mb-10 drop-shadow-md">
          A Live Trivia Experience
        </p>

        <div className="seam-rule w-48 my-2 opacity-50" />

        <p className="max-w-md text-muted/90 font-body mb-12 mt-10 text-lg leading-relaxed">
          Explore the shared traditions, food, and values of Gujarat and Mauritius. One person hosts, everyone else plays!
        </p>

        <div className="flex flex-col sm:flex-row gap-6 w-full max-w-md">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="flex-1">
            <Link
              to="/host"
              className="w-full flex items-center justify-center gap-3 bg-saffron text-night font-bold text-lg py-5 rounded-2xl shadow-[0_0_30px_rgba(242,169,59,0.3)] border-2 border-transparent hover:border-white/20 transition-all"
            >
              <Globe size={22} />
              Host a Game
            </Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="flex-1">
            <Link
              to="/play"
              className="w-full flex items-center justify-center gap-3 bg-lagoon text-night font-bold text-lg py-5 rounded-2xl shadow-[0_0_30px_rgba(47,191,174,0.3)] border-2 border-transparent hover:border-white/20 transition-all"
            >
              <Users size={22} />
              Join Game
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
