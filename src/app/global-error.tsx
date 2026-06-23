'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: '#09090b', color: 'white', fontFamily: 'system-ui, sans-serif' }}>
          <h2>A fatal global error occurred!</h2>
          <button onClick={() => reset()} style={{ marginTop: '1rem', padding: '0.5rem 1rem', borderRadius: '4px', background: 'white', color: 'black', border: 'none', cursor: 'pointer' }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
