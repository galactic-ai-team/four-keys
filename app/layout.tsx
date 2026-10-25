import "./globals.css";
export const metadata = { title: "Four Keys", description: "A free daily puzzle by the AI team" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className="bg-slate-950 text-slate-100 min-h-screen">{children}</body></html>;
}
