import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Card } from "@/types";

export default function CardItem({ card, onOpen, overlay }: { card: Card; onOpen: () => void; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  const style = overlay ? undefined : { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const hasMeta = !!card.labels?.length || !!card.assignees?.length;

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={style}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      onClick={onOpen}
      className={`cursor-pointer rounded-card border border-line bg-white p-3 text-sm shadow-card hover:border-teal ${overlay ? "rotate-1 shadow-raised" : ""}`}
    >
      <p className="leading-snug">{card.title}</p>
      {hasMeta && (
        <div className="mt-2 flex items-center gap-2">
          {card.labels?.map((l) => <span key={l.id} title={l.name} className="h-2 w-6 rounded-full" style={{ backgroundColor: l.color }} />)}
          {!!card.assignees?.length && <span className="ms-auto rounded-full bg-paper px-2 py-0.5 text-xs text-inkSoft">{card.assignees.length} مسئول</span>}
        </div>
      )}
    </div>
  );
}
