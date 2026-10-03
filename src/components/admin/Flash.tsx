export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (error)
    return (
      <div className="flash error" role="alert">
        {error}
      </div>
    );
  if (ok)
    return (
      <div className="flash" role="status">
        {ok}
      </div>
    );
  return null;
}
