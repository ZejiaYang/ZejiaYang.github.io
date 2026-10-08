import Terminal from "@/components/terminal/terminal";
import { bootSession } from "@/lib/shell/boot";

export default function Home() {
  const { lines, cwd } = bootSession(new Date());
  return <Terminal key="home" initialLines={lines} initialCwd={cwd} />;
}
