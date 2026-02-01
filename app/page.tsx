import Pricing from '@/components/ui/Pricing/Pricing';
import { createClient } from '@/utils/supabase/server';
import {
  getProducts,
  getSubscription,
  getUser
} from '@/utils/supabase/queries';
import { redirect } from 'next/navigation';
import { Sparkles, Scan, Zap, Shield, TrendingUp } from 'lucide-react';

export default async function HomePage() {
  const supabase = await createClient();
  const [user, products, subscription] = await Promise.all([
    getUser(supabase),
    getProducts(supabase),
    getSubscription(supabase)
  ]);

  // If user is authenticated, redirect to assets
  if (user) {
    return redirect('/assets');
  }

  return (
    <div className="bg-background min-h-screen">
      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center mb-20 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm text-primary font-medium">AI-Powered Logo Detection</span>
          </div>
          
          <h1 className="text-5xl font-extrabold text-foreground sm:text-6xl lg:text-7xl mb-6">
            <span className="text-gradient">logodetekt</span>
          </h1>
          
          <p className="mt-6 max-w-2xl mx-auto text-xl text-muted-foreground">
            AI-powered logo detection and analysis. 
            Upload videos or images and let our AI identify brand logos automatically.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="p-6 rounded-xl bg-card/50 border border-border backdrop-blur-sm hover:border-primary/50 hover:glow-primary transition-all duration-300">
            <div className="w-12 h-12 rounded-lg gradient-accent flex items-center justify-center mb-4">
              <Scan className="w-6 h-6 text-primary-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Frame-by-Frame Analysis</h3>
            <p className="text-sm text-muted-foreground">
              Advanced AI scans every frame to detect and track logos with precision
            </p>
          </div>

          <div className="p-6 rounded-xl bg-card/50 border border-border backdrop-blur-sm hover:border-primary/50 hover:glow-primary transition-all duration-300">
            <div className="w-12 h-12 rounded-lg gradient-accent flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-primary-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Lightning Fast</h3>
            <p className="text-sm text-muted-foreground">
              Process videos and images in seconds with our optimized AI engine
            </p>
          </div>

          <div className="p-6 rounded-xl bg-card/50 border border-border backdrop-blur-sm hover:border-primary/50 hover:glow-primary transition-all duration-300">
            <div className="w-12 h-12 rounded-lg gradient-accent flex items-center justify-center mb-4">
              <TrendingUp className="w-6 h-6 text-primary-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Detailed Analytics</h3>
            <p className="text-sm text-muted-foreground">
              Get comprehensive insights on logo appearances and brand visibility
            </p>
          </div>
        </div>

        {/* Pricing Section */}
        <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <Pricing
            user={user}
            products={products ?? []}
            subscription={subscription}
          />
        </div>
      </div>
    </div>
  );
}
