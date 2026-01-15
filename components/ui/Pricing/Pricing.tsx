'use client';

import Button from '@/components/ui/Button';
import LogoCloud from '@/components/ui/LogoCloud';
import type { Tables } from '@/types_db';
import { getStripe } from '@/utils/stripe/client';
import { checkoutWithStripe } from '@/utils/stripe/server';
import { getErrorRedirect } from '@/utils/helpers';
import { User } from '@supabase/supabase-js';
import cn from 'classnames';
import { useRouter, usePathname } from 'next/navigation';
import { useState } from 'react';
import { Check } from 'lucide-react';

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
  const currentPath = usePathname();

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
  } else {
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
          {products.map((product) => {
            const price = product?.prices?.find(
              (price) => price.interval === billingInterval
            );
            if (!price) return null;
            const priceString = new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: price.currency!,
              minimumFractionDigits: 0
            }).format((price?.unit_amount || 0) / 100);
            const isCurrentPlan = subscription
              ? product.name === subscription?.prices?.products?.name
              : product.name === 'Freelancer';
            return (
              <div
                key={product.id}
                className={cn(
                  'flex flex-col rounded-xl shadow-sm divide-y divide-border bg-card/50 backdrop-blur-sm border transition-all duration-300',
                  {
                    'border-primary glow-primary': isCurrentPlan,
                    'border-border hover:border-primary/50 hover:glow-primary': !isCurrentPlan
                  },
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
                    {subscription ? 'Manage' : 'Subscribe'}
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
}
