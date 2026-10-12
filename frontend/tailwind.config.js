/** @type {import('tailwindcss').Config} */
// Design tokens. Contrast on the main surface (#0E0E10):
// ink 17.1:1, ink2 7.7:1, accent 10.6:1, danger 8.4:1, success 11.1:1.
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      colors: {
        bg: "#0E0E10",
        surface: "#17161A",
        surface2: "#222127",
        line: "#2C2A31",
        ink: "#F4F1EA",
        ink2: "#A8A39A",
        accent: "#F2B54A",
        "accent-ink": "#1A1204",
        danger: "#FF8A7A",
        success: "#8FD4A0",
      },
      fontFamily: {
        sans: [
          "-apple-system", "BlinkMacSystemFont", "\"SF Pro Text\"", "\"Segoe UI\"",
          "Roboto", "system-ui", "sans-serif",
        ],
      },
      borderRadius: {
        card: "14px",
      },
    },
  },
  plugins: [],
};
