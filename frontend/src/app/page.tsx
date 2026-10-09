import { Coffee, Activity, Award, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white font-sans overflow-hidden selection:bg-amber-500/30">
      {/* Background Gradients */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-amber-500/20 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-orange-600/10 blur-[150px]" />
      </div>

      {/* Navigation */}
      <nav className="flex items-center justify-between px-8 py-6 max-w-7xl mx-auto backdrop-blur-md bg-black/20 sticky top-0 z-50 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="bg-gradient-to-br from-amber-400 to-orange-600 p-2 rounded-xl">
            <Coffee className="w-6 h-6 text-black" />
          </div>
          <span className="text-xl font-bold tracking-tight">BrewLite</span>
        </div>
        <div className="hidden md:flex gap-8 text-sm font-medium text-neutral-400">
          <a href="#" className="hover:text-amber-400 transition-colors">Features</a>
          <a href="#" className="hover:text-amber-400 transition-colors">Process</a>
          <a href="#" className="hover:text-amber-400 transition-colors">Community</a>
        </div>
        <button className="px-5 py-2.5 rounded-full bg-white text-black text-sm font-semibold hover:bg-neutral-200 transition-all duration-300">
          Get Started
        </button>
      </nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-8 pt-32 pb-24 text-center flex flex-col items-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-semibold mb-8 backdrop-blur-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          New: AI Brewing Assistant
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter leading-[1.1] mb-6">
          Master the Art of <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-500 to-red-500">
            Perfect Brewing.
          </span>
        </h1>

        <p className="text-lg md:text-xl text-neutral-400 max-w-2xl mb-10 leading-relaxed">
          BrewLite is your minimal, powerful companion for tracking, analyzing, and perfecting every cup of coffee. Experience brewing clarity.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <button className="flex items-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold text-lg hover:shadow-[0_0_40px_rgba(245,158,11,0.4)] transition-all duration-300 hover:scale-105">
            Start Brewing
            <ArrowRight className="w-5 h-5" />
          </button>
          <button className="px-8 py-4 rounded-full border border-white/10 bg-white/5 backdrop-blur-md text-white font-semibold text-lg hover:bg-white/10 transition-all duration-300">
            View Demo
          </button>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-32 w-full text-left">
          {[
            { title: "Precision Tracking", icon: <Activity className="w-6 h-6 text-amber-500" />, desc: "Log parameters like grind size, temperature, and ratio with a single tap." },
            { title: "Smart Analytics", icon: <Coffee className="w-6 h-6 text-orange-500" />, desc: "Visualize your brewing patterns and discover your perfect flavor profile." },
            { title: "Pro Recipes", icon: <Award className="w-6 h-6 text-red-500" />, desc: "Access award-winning recipes from champion baristas around the globe." }
          ].map((feature, i) => (
            <div key={i} className="group p-8 rounded-3xl border border-white/5 bg-white/[0.02] backdrop-blur-sm hover:bg-white/[0.04] transition-colors duration-300 hover:border-white/10">
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
              <p className="text-neutral-400 leading-relaxed">
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
