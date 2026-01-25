import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light' | 'system';
type ColorTheme = 'default' | 'blue' | 'green' | 'yellow' | 'rose' | 'violet' | 'red';

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  defaultColorTheme?: ColorTheme;
  storageKey?: string;
  colorThemeStorageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  colorTheme: ColorTheme;
  setTheme: (theme: Theme) => void;
  setColorTheme: (colorTheme: ColorTheme) => void;
};

const initialState: ThemeProviderState = {
  theme: 'system',
  colorTheme: 'blue',
  setTheme: () => null,
  setColorTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  defaultColorTheme = 'blue',
  storageKey = 'buildn-ui-theme',
  colorThemeStorageKey = 'buildn-ui-color-theme',
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );

  const [colorTheme, setColorThemeState] = useState<ColorTheme>(
    () => (localStorage.getItem(colorThemeStorageKey) as ColorTheme) || defaultColorTheme
  );

  // Load theme CSS dynamically
  useEffect(() => {
    const loadThemeCSS = async () => {
      // Remove any existing theme stylesheets
      const existingTheme = document.getElementById('theme-stylesheet');
      if (existingTheme) {
        existingTheme.remove();
      }

      // Dynamically import the theme CSS
      try {
        await import(`../themes/${colorTheme}.css`);

        // Create a new style element with the theme
        const style = document.createElement('link');
        style.id = 'theme-stylesheet';
        style.rel = 'stylesheet';
        style.href = `/src/themes/${colorTheme}.css`;
        document.head.appendChild(style);
      } catch (error) {
        console.error(`Failed to load theme: ${colorTheme}`, error);
      }
    };

    loadThemeCSS();
  }, [colorTheme]);

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
        .matches
        ? 'dark'
        : 'light';

      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  const setColorTheme = (newColorTheme: ColorTheme) => {
    localStorage.setItem(colorThemeStorageKey, newColorTheme);
    setColorThemeState(newColorTheme);
  };

  const value = {
    theme,
    colorTheme,
    setTheme: (newTheme: Theme) => {
      localStorage.setItem(storageKey, newTheme);
      setTheme(newTheme);
    },
    setColorTheme,
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider');

  return context;
};
