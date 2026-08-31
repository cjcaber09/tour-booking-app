import './ComingSoon.css';

interface ComingSoonProps {
  title: string;
}

export function ComingSoon({ title }: ComingSoonProps) {
  return (
    <div className="coming-soon">
      <h1>{title}</h1>
      <p>This section isn't built yet.</p>
    </div>
  );
}
