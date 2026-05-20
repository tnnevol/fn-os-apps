export default function useDarkMode() {
  const prefersDark = import.meta.client
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : false;
  const isDark = useLocalStorage("dark-mode", prefersDark);

  useHead({
    htmlAttrs: {
      class: isDark.value ? "dark" : "",
    },
  });

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
