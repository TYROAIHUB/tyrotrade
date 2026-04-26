import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/brand/Logo";

export function LoginPage() {
  return (
    <div className="h-screen w-screen grid place-items-center p-6">
      <GlassPanel
        tone="strong"
        noise
        className="rounded-3xl max-w-md w-full p-10 text-center"
      >
        <Logo size={72} className="mx-auto mb-5" />
        <h1 className="text-4xl font-extrabold tracking-tight mb-1 lowercase">
          <span className="text-foreground">tyro</span>
          <span className="text-prism-gradient">trade</span>
        </h1>
        <p className="text-sm text-muted-foreground mb-1">
          International Trade · Operations Cockpit
        </p>
        <Badge variant="warning" className="mt-3 mb-6">
          Phase D · MSAL Globe Login
        </Badge>
        <p className="text-sm text-muted-foreground mb-6">
          MSAL + Three.js Globe sahnesi sonraki fazda eklenecek. Şimdilik
          dashboard'u doğrudan görüntüleyebilirsiniz.
        </p>
        <Button asChild className="w-full" size="lg">
          <Link to="/projects">
            Projects'e geç
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </GlassPanel>
    </div>
  );
}
