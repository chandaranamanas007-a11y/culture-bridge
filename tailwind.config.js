/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        night: "#10122B",
        surface: "#191B3A",
        surface2: "#22254A",
        saffron: "#F2A93B",
        saffron2: "#E08B1D",
        lagoon: "#2FBFAE",
        lagoon2: "#1E8F82",
        cream: "#F5F1E8",
        muted: "#8B8FB8",
      },
      fontFamily: {
        display: ["Fraunces", "serif"],
        body: ["Work Sans", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      backgroundImage: {
        seam: "linear-gradient(90deg, #F2A93B 0%, #F2A93B 48%, #2FBFAE 52%, #2FBFAE 100%)",
      },
    },
  },
  plugins: [],
};
