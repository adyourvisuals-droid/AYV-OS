'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import { Button, Input } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

/** Seeded accounts, offered as one-click fills so the demo is explorable. */
const DEMO_ACCOUNTS = [
  { email: 'rahul@adyourvision.com', role: 'Super Admin', note: 'sees everything' },
  { email: 'vikram@adyourvision.com', role: 'Sales Head', note: 'whole pipeline' },
  { email: 'priya@adyourvision.com', role: 'Sales Executive', note: 'own leads only' },
  { email: 'ananya@adyourvision.com', role: 'Creative Head', note: 'production queue' },
  { email: 'sameer@adyourvision.com', role: 'Designer', note: 'no CRM, no financials' },
];

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('rahul@adyourvision.com');
  const [password, setPassword] = useState('AyvOs@2026!');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [loading, user, router]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(email, password);
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Could not sign in. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500 text-lg font-bold text-white shadow-md">
            A
          </div>
          <h1 className="text-heading-lg text-primary">Welcome to AYV OS</h1>
          <p className="mt-1 text-body-sm text-secondary">
            The operating system of Ad Your Vision
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-subtle bg-surface p-6 shadow-sm">
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-caption text-secondary">
              Email
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-caption text-secondary">
              Password
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-md border border-danger/20 bg-danger-bg px-3 py-2 text-body-sm text-danger"
            >
              {error}
            </p>
          )}

          <Button type="submit" size="lg" loading={submitting} className="w-full">
            Sign in
          </Button>
        </form>

        <div className="mt-6">
          <p className="mb-2 text-center text-overline uppercase text-tertiary">
            Demo accounts · password AyvOs@2026!
          </p>
          <div className="space-y-1">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => {
                  setEmail(account.email);
                  setPassword('AyvOs@2026!');
                }}
                className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left transition-colors hover:bg-sunken"
              >
                <span className="text-body-sm font-medium text-primary">{account.role}</span>
                <span className="text-caption text-tertiary">{account.note}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
