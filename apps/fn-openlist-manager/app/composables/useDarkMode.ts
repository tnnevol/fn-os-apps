export default function useDarkMode() {
  const isDark = useLocalStorage("dark-mode", false);

  useHead({
    htmlAttrs: {
      class: isDark.value ? "dark" : "",
    },
  });

  // Sync class to html element for Element Plus dark theme
  if (import.meta.client) {
    watch(
      isDark,
      (val) => {
        if (val) {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      },
      { immediate: true }
    );
  }

  const toggleDark = () => {
    isDark.value = !isDark.value;
  };

  return { isDark, toggleDark };
}
