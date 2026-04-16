export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-start overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(232,89,89,0.18),_transparent_38%),linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(250,246,244,0.96)_100%)] px-4 pb-4 pt-24 sm:px-6 sm:pb-6 sm:pt-28 lg:justify-center lg:pt-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8rem] top-[-6rem] h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-[-8rem] right-[-5rem] h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      </div>
      <div className="relative z-10 flex w-full justify-center lg:items-center">
        {children}
      </div>
    </div>
  );
}
