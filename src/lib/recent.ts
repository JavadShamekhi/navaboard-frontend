import {useCallback, useState} from "react";

type Id = string | number;
const KEY = "recent:v1";

type Store = { ws: Id[]; boards: Record<string, Id[]>; lastWs?: Id };

function read(): Store {
	try {
		return {ws: [], boards: {}, ...JSON.parse(localStorage.getItem(KEY) ?? "{}")};
	} catch {
		return {ws: [], boards: {}};
	}
}

function write(s: Store) {
	try {
		localStorage.setItem(KEY, JSON.stringify(s));
	} catch {
		/* پر بودن یا غیرفعال بودن storage مهم نیست */
	}
}

const bump = (arr: Id[], id: Id) => [id, ...arr.filter((x) => String(x) !== String(id))].slice(0, 50);

/** ثبت استفاده؛ از هرجای برنامه (صفحه‌ی برد، صفحه‌ی workspace و...) قابل صدا زدن است */
export function touchWorkspace(id: Id) {
	const s = read();
	write({...s, ws: bump(s.ws, id), lastWs: id});
}

export function touchBoard(workspaceId: Id, boardId: Id) {
	const s = read();
	const key = String(workspaceId);
	write({
		...s,
		ws: bump(s.ws, workspaceId),
		lastWs: workspaceId,
		boards: {...s.boards, [key]: bump(s.boards[key] ?? [], boardId)},
	});
}

export function getLastWorkspace(): Id | undefined {
	return read().lastWs;
}

/** مرتب‌سازی: آیتم‌های اخیر اول (به ترتیب استفاده)، بقیه با ترتیب اصلی */
export function sortByRecent<T extends { id: Id }>(items: T[], recent: Id[]): T[] {
	const rank = new Map(recent.map((id, i) => [String(id), i]));
	return [...items].sort((a, b) => {
		const ra = rank.get(String(a.id)) ?? Infinity;
		const rb = rank.get(String(b.id)) ?? Infinity;
		return ra === rb ? 0 : ra - rb;
	});
}

/** برای اینکه بعد از touch، کامپوننت دوباره رندر شود */
export function useRecent() {
	const [store, setStore] = useState<Store>(read);
	const refresh = useCallback(() => setStore(read()), []);
	return {store, refresh};
}