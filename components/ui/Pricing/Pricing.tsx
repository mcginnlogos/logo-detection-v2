'use client';

import Button from '@/components/ui/Button';
import LogoCloud from '@/components/ui/LogoCloud';
import type { Tables } from '@/types_db';
import { getStripe } from '@/utils/stripe/client';
import { checkoutWithStripe, createStripePortal } from '@/utils/stripe/server';
import { getErrorRedirect } from '@/utils/helpers';
import { User } from '@supabase/supabase-js';
import cn from 'classnames';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

type Subscription = Tables<'subscriptions'>;
type Product = Tables<'products'>;
type Price = Tables<'prices'>;
interface ProductWithPrices extends Product {
  prices: Price[];
}
interface PriceWithProduct extends Price {
  products: Product | null;
}
interface SubscriptionWithProduct extends Subscription {
  prices: PriceWithProduct | null;
}

interface Props {
  user: User | null | undefined;
  products: ProductWithPrices[];
  subscription: SubscriptionWithProduct | null;
}

type BillingInterval = 'lifetime' | 'year' | 'month';

export default function Pricing({ user, products, subscription }: Props) {
  const intervals = Array.from(
    new Set(
      products.flatMap((product) =>
        product?.prices?.map((price) => price?.interval)
      )
    )
  );
  const router = useRouter();
  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>('month');
  const [priceIdLoading, setPriceIdLoading] = useState<string>();
  const [portalLoading, setPortalLoading] = useState(false);
  const [usageStats, setUsageStats] = useState<{
    framesUsed: number;
    frameLimit: number;
    overageFrames: number;
  } | null>(null);
  const currentPath = usePathname();

  // Fetch usage stats for subscribed users
  useEffect(() => {
    if (subscription && subscription.status === 'active' && user) {
      fetch('/api/usage-stats')
        .then(res => res.json())
        .then(data => setUsageStats(data))
        .catch(err => console.error('Failed to fetch usage:', err));
    }
  }, [subscription, user]);

  const handleStripePortal = async () => {
    setPortalLoading(true);
    const portalUrl = await createStripePortal(currentPath);
    if (portalUrl) {
      window.location.href = portalUrl;
    }
    setPortalLoading(false);
  };

  const handleStripeCheckout = async (price: Price) => {
    setPriceIdLoading(price.id);

    if (!user) {
      setPriceIdLoading(undefined);
      return router.push('/signin');
    }

    const { errorRedirect, sessionId } = await checkoutWithStripe(
      price,
      currentPath
    );

    if (errorRedirect) {
      setPriceIdLoading(undefined);
      return router.push(errorRedirect);
    }

    if (!sessionId) {
      setPriceIdLoading(undefined);
      return router.push(
        getErrorRedirect(
          currentPath,
          'An unknown error occurred.',
          'Please try again later or contact a system administrator.'
        )
      );
    }

    const stripe = await getStripe();
    stripe?.redirectToCheckout({ sessionId });

    setPriceIdLoading(undefined);
  };

  if (!products.length) {
    return (
      <div>
        <div className="sm:flex sm:flex-col sm:align-center"></div>
        <p className="text-4xl font-extrabold text-foreground sm:text-center sm:text-6xl">
          No subscription pricing plans found. Create them in your{' '}
          <a
            className="text-primary underline"
            href="https://dashboard.stripe.com/products"
            rel="noopener noreferrer"
            target="_blank"
          >
            Stripe Dashboard
          </a>
          .
        </p>
        <LogoCloud />
      </div>
    );
  }

  // Show current plan details for subscribed users
  if (subscription && subscription.status === 'active') {
    const currentProduct = subscription.prices?.products;
    const currentPrice = subscription.prices;
    const renewalDate = new Date(subscription.current_period_end).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return (
      <div className="max-w-4xl mx-auto">
        <div className="sm:flex sm:flex-col sm:align-center">
          <h1 className="text-4xl font-extrabold text-foreground sm:text-center sm:text-6xl">
            Your Subscription
          </h1>
          <p className="max-w-2xl m-auto mt-5 text-xl text-muted-foreground sm:text-center sm:text-2xl">
            Manage your current plan and usage
          </p>
        </div>

        <div className="mt-12 bg-card border border-border rounded-xl shadow-lg p-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-3xl font-bold text-foreground">{currentProduct?.name}</h2>
              <p className="text-muted-foreground mt-2">{currentProduct?.description}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-foreground">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: currentPrice?.currency || 'usd',
                  minimumFractionDigits: 0
                }).format((currentPrice?.unit_amount || 0) / 100)}
              </div>
              <div className="text-sm text-muted-foreground">
                per {currentPrice?.interval}
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-6 space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Frame Usage</span>
                <span className="font-medium text-foreground">
                  {usageStats ? `${usageStats.framesUsed.toLocaleString()} / ${usageStats.frameLimit.toLocaleString()}` : 'Loading...'}
                </span>
              </div>
              {usageStats && (
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${Math.min((usageStats.framesUsed / usageStats.frameLimit) * 100, 100)}%` }}
                  />
                </div>
              )}
              {usageStats && usageStats.overageFrames > 0 && (
                <p className="text-sm text-amber-600 mt-2">
                  {usageStats.overageFrames.toLocaleString()} overage frames will be billed
                </p>
              )}
            </div>

            <div className="flex justify-between text-sm pt-4">
              <span className="text-muted-foreground">Renewal Date</span>
              <span className="font-medium text-foreground">{renewalDate}</span>
            </div>

            {subscription.cancel_at_period_end && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mt-4">
                <p className="text-sm text-amber-600">
                  Your subscription will be canceled on {renewalDate}
                </p>
              </div>
            )}
          </div>

          <div className="mt-8">
            <Button
              variant="slim"
              type="button"
              disabled={portalLoading}
              loading={portalLoading}
              onClick={handleStripePortal}
              className="w-full"
            >
              Manage Subscription
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Show pricing options for free tier users
  return (
    <div>
      <div className="sm:flex sm:flex-col sm:align-center">
        <h1 className="text-4xl font-extrabold text-foreground sm:text-center sm:text-6xl">
          Pricing Plans
        </h1>
        <p className="max-w-2xl m-auto mt-5 text-xl text-muted-foreground sm:text-center sm:text-2xl">
          Choose the perfect plan for your logo detection needs.
        </p>
        <div className="relative self-center mt-6 bg-secondary rounded-lg p-0.5 flex sm:mt-8 border border-border">
        {intervals.includes('month') && (
          <button
            onClick={() => setBillingInterval('month')}
            type="button"
            className={`${
              billingInterval === 'month'
                ? 'relative w-1/2 bg-sidebar-accent border-border shadow-sm text-foreground'
                : 'ml-0.5 relative w-1/2 border border-transparent text-muted-foreground'
            } rounded-md m-1 py-2 text-sm font-medium whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 focus:z-10 sm:w-auto sm:px-8 transition-all`}
          >
            Monthly billing
          </button>
        )}
        {intervals.includes('year') && (
          <button
            onClick={() => setBillingInterval('year')}
            type="button"
            className={`${
              billingInterval === 'year'
                ? 'relative w-1/2 bg-sidebar-accent border-border shadow-sm text-foreground'
                : 'ml-0.5 relative w-1/2 border border-transparent text-muted-foreground'
            } rounded-md m-1 py-2 text-sm font-medium whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 focus:z-10 sm:w-auto sm:px-8 transition-all`}
          >
            Yearly billing
          </button>
        )}
        </div>
      </div>
      <div className="mt-12 space-y-0 sm:mt-16 flex flex-wrap justify-center gap-6 lg:max-w-4xl lg:mx-auto xl:max-w-none xl:mx-0">
        {products
          .sort((a, b) => {
            const priceA = a.prices?.find(p => p.interval === billingInterval && p.usage_type !== 'metered')?.unit_amount || 0;
            const priceB = b.prices?.find(p => p.interval === billingInterval && p.usage_type !== 'metered')?.unit_amount || 0;
            return priceA - priceB;
          })
          .map((product) => {
          const price = product?.prices?.find(
            (price) => price.interval === billingInterval && price.usage_type !== 'metered'
          );
          if (!price) return null;
          const priceString = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: price.currency!,
            minimumFractionDigits: 0
          }).format((price?.unit_amount || 0) / 100);
          
          return (
            <div
              key={product.id}
              className={cn(
                'flex flex-col rounded-xl shadow-sm divide-y divide-border bg-card/50 backdrop-blur-sm border border-border hover:border-primary/50 hover:glow-primary transition-all duration-300',
                'flex-1',
                'basis-1/3',
                'max-w-xs'
              )}
            >
              <div className="p-6">
                <h2 className="text-2xl font-semibold leading-6 text-foreground">
                  {product.name}
                </h2>
                <p className="mt-4 text-muted-foreground">{product.description}</p>
                <p className="mt-8">
                  <span className="text-5xl font-extrabold text-foreground">
                    {priceString}
                  </span>
                  <span className="text-base font-medium text-muted-foreground">
                    /{billingInterval}
                  </span>
                </p>
                <Button
                  variant="slim"
                  type="button"
                  loading={priceIdLoading === price.id}
                  onClick={() => handleStripeCheckout(price)}
                  className="block w-full py-2 mt-8 text-sm font-semibold text-center rounded-md transition-all"
                >
                  Subscribe
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      <LogoCloud />
    </div>
  );
}
