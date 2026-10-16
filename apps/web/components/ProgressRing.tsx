export function ProgressRing({ value }: {
    value: number;
}) {
    const r = 68, c = 2 * Math.PI * r, dash = (value / 100) * c;
    return <svg className="progress-ring" viewBox="0 0 160 160" role="img" aria-label={`${value}% career readiness`}><circle className="track" cx="80" cy="80" r={r} fill="none"/><circle className="value" cx="80" cy="80" r={r} fill="none" strokeDasharray={`${dash} ${c - dash}`}/></svg>;
}
