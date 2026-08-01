export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-1 text-center">
          <span className="text-lg font-semibold tracking-tight">
            AYV OS
          </span>
          <span className="text-sm text-muted-foreground">
            Operations platform for AdYourVisuals
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
