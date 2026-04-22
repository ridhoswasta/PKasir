export const isTauri = () => {
  return (window as any).__TAURI_INTERNALS__ !== undefined;
};
