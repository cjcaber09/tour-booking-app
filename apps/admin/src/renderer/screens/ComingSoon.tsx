interface ComingSoonProps {
  title: string;
}

export function ComingSoon({ title }: ComingSoonProps) {
  return (
    <div className="p-8">
      <h1 className="m-0 mb-2 font-display text-[2rem] tracking-[0.05em] text-heading">{title}</h1>
      <p className="m-0 text-sm text-muted">This section isn't built yet.</p>
    </div>
  );
}
