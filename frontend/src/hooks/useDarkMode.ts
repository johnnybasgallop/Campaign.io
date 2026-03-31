import { useState } from "react";

export function useDarkMode() {
  const [dark, setDark] = useState(false);

  function toggleDark() {
    setDark((prev) => {
      document.documentElement.classList.toggle("dark", !prev);
      return !prev;
    });
  }

  return { dark, toggleDark };
}
