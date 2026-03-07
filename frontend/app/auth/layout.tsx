import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Authentication - Agentum",
  description: "Sign in or create an account on Agentum",
};

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/20 p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo / Brand */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground text-xl font-bold">A</span>
            </div>
            <span className="text-2xl font-bold">Agentum</span>
          </div>
          <p className="text-muted-foreground text-sm">
            AI Agent Management Platform
          </p>
        </div>
        
        {/* Auth Form */}
        {children}
      </div>
    </div>
  );
}
