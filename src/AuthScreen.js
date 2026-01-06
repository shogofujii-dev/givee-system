import React, { useMemo, useState } from 'react';
import { supabase } from './supabaseClient';

export default function AuthScreen() {
  const [mode, setMode] = useState('signIn'); // 'signIn' | 'signUp'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const title = useMemo(() => (mode === 'signIn' ? 'ログイン' : '新規登録'), [mode]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      if (mode === 'signIn') {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      } else {
        const { error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        setMessage('登録しました。メール確認が必要な場合は受信箱を確認してください。');
      }
    } catch (err) {
      setError(err?.message || '認証に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!email) return;
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
      if (resetError) throw resetError;
      setMessage('パスワード再発行メールを送信しました（届かない場合は迷惑メールも確認してください）。');
    } catch (err) {
      setError(err?.message || 'パスワード再発行に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFE900] flex items-center justify-center p-6 text-black font-sans overflow-hidden">
      <div className="bg-white border-[6px] border-black p-10 md:p-14 max-w-md w-full shadow-[24px_24px_0px_rgba(0,0,0,1)]">
        <h1 className="text-3xl font-black italic tracking-tighter mb-2">GIVEE 認証</h1>
        <p className="text-[11px] font-black tracking-widest uppercase text-slate-500 mb-8">{title}</p>

        {error && (
          <div className="mb-4 border-4 border-black bg-white p-3 text-[11px] font-black">
            <p className="text-red-600">{error}</p>
          </div>
        )}
        {message && (
          <div className="mb-4 border-4 border-black bg-white p-3 text-[11px] font-black">
            <p>{message}</p>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border-4 border-black font-black outline-none focus:bg-[#FFE900]/20"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border-4 border-black font-black outline-none focus:bg-[#FFE900]/20"
              placeholder="********"
              autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-black text-white font-black uppercase tracking-[0.3em] border-4 border-black shadow-[8px_8px_0px_#EC6C00] active:translate-y-1 active:shadow-none transition-all disabled:opacity-60"
          >
            {loading ? '処理中…' : title}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => { setMode(mode === 'signIn' ? 'signUp' : 'signIn'); setError(null); setMessage(null); }}
            className="text-[11px] font-black underline"
          >
            {mode === 'signIn' ? '新規登録はこちら' : 'ログインはこちら'}
          </button>
          <button
            type="button"
            onClick={resetPassword}
            className="text-[11px] font-black underline text-slate-500 disabled:opacity-40"
            disabled={!email || loading}
            title="メールアドレスを入力してから押してください"
          >
            パスワード再発行
          </button>
        </div>
      </div>
    </div>
  );
}


