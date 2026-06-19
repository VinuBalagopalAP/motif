"use client";

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      }
      router.push('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f9f9fa] py-12 px-4 sm:px-6 lg:px-8 relative font-sans">
      
      <div className="max-w-md w-full relative z-10">
        <div className="bg-white p-10 rounded-[24px] shadow-[0_8px_40px_rgba(0,0,0,0.04)] border border-gray-100">
          <div className="mb-10 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-[#282828] mb-2">
              {isLogin ? 'Welcome back' : 'Create your account'}
            </h1>
            <p className="text-sm text-[#757575] font-medium">
              {isLogin ? 'Sign in to access Motif' : 'Start generating beautiful videos'}
            </p>
          </div>
          
          <form className="space-y-6" onSubmit={handleAuth}>
            {error && (
              <div className="bg-red-50 text-red-600 rounded-xl p-4 text-sm font-medium border border-red-100">
                <p>{error}</p>
              </div>
            )}
            
            <div className="space-y-5">
              <div>
                <label htmlFor="email-address" className="block text-sm font-medium text-[#282828] mb-2">
                  Email
                </label>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="w-full px-4 py-3 bg-[#f9f9fa] border border-gray-200 rounded-xl text-[#282828] placeholder-gray-400 focus:outline-none focus:border-[#08c225] focus:ring-1 focus:ring-[#08c225] transition-all font-medium text-sm"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="password" className="block text-sm font-medium text-[#282828]">
                    Password
                  </label>
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="w-full px-4 py-3 bg-[#f9f9fa] border border-gray-200 rounded-xl text-[#282828] placeholder-gray-400 focus:outline-none focus:border-[#08c225] focus:ring-1 focus:ring-[#08c225] transition-all font-medium text-sm"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl text-sm font-semibold text-white bg-[#08c225] shadow-[0_4px_12px_rgba(8,194,37,0.2)] hover:bg-[#00b33c] hover:shadow-[0_6px_16px_rgba(8,194,37,0.3)] disabled:opacity-50 transition-all duration-200"
              >
                {loading ? (
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  isLogin ? "Sign in" : "Sign up"
                )}
              </button>
            </div>
            
            <div className="pt-6 text-center">
              <button 
                type="button"
                onClick={() => setIsLogin(!isLogin)} 
                className="text-sm font-medium text-[#757575] hover:text-[#08c225] transition-colors"
              >
                {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
