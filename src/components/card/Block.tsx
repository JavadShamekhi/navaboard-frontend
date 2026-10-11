export default function Block({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-inkSoft">{title}</h3>
        {right}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
