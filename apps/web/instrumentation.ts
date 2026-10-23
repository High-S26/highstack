/** Beim Serverstart: Dauerlauf der Trading-Agenten (nur Node-Laufzeit) */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { starteDauerlauf } = await import("./lib/dauerlauf");
    starteDauerlauf();
  }
}
