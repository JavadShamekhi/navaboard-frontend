/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#EEF0F2", paperRaised: "#FFFFFF", ink: "#1B2430", inkSoft: "#4B5566", line: "#D8DCE3",
        amber: { DEFAULT: "#D69A2D", soft: "#F3E3C2" },
        teal: { DEFAULT: "#2F6E6B", soft: "#DCEBE9" },
        rose: { DEFAULT: "#B5495B", soft: "#F3DCE0" },
      },
      fontFamily: { sans: ["Vazirmatn", "system-ui", "sans-serif"] },
      borderRadius: { card: "10px", chip: "6px" },
      boxShadow: {
        card: "0 1px 2px rgba(27,36,48,0.06), 0 1px 1px rgba(27,36,48,0.04)",
        raised: "0 4px 14px rgba(27,36,48,0.14)",
      },
    },
  },
  plugins: [],
};
