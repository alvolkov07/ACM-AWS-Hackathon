import Header from "@/components/Header";
import Hero from "@/components/Hero";
import HeroBackground from "@/components/HeroBackground";

export default function Home() {
  return (
    <main className="min-h-screen bg-surface p-3 md:p-4">
      {/* Photo panel; the cream page shows around it as a frame. */}
      <div className="relative flex min-h-[calc(100svh-1.5rem)] flex-col overflow-hidden rounded-[28px] bg-field md:min-h-[calc(100svh-2rem)] md:rounded-[36px]">
        <HeroBackground />
        <Header />
        <Hero />
      </div>
    </main>
  );
}
