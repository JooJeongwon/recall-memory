import { isConfigured } from "@/lib/config";
import { OpeningSplash } from "@/components/branding/OpeningSplash";
import { LandingAnimated } from "@/components/landing/LandingAnimated";

export default function Home() {
  return (
    <>
      <OpeningSplash />
      <LandingAnimated configured={isConfigured()} />
    </>
  );
}
