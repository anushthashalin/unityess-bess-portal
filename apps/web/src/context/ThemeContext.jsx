import { createContext, useContext, useEffect, useState } from 'react';

// Themes: 'light' | 'dark' | 'solar'
const ThemeContext = createContext({ theme: 'light', setTheme: () => {} });

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem('portal-theme') ?? 'light';
  });

  function setTheme(t) {
    setThemeState(t);
    localStorage.setItem('portal-theme', t);
  }

  useEffect(() => {
    const root = document.documentElement;

    // remove all theme markers first
    root.classList.remove('dark');
    root.removeAttribute('data-theme');

    if (theme === 'dark') {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    } else if (theme === 'solar') {
      root.setAttribute('data-theme', 'solar');
    } else {
      root.setAttribute('data-theme', 'light');
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
